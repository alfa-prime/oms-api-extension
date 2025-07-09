import re
from datetime import datetime
from typing import List, Dict, Any

from app.core import get_settings, HTTPXClient, logger
from app.core.decorators import log_and_catch
from .helpers import (
    filter_operations_from_services,
    process_diagnosis_list,
)

settings = get_settings()
HEADERS = {
    "Origin": settings.BASE_HEADERS_ORIGIN_URL,
    "Referer": settings.BASE_HEADERS_REFERER_URL,
}


async def _make_api_post_request(
    cookies: dict, http_service: HTTPXClient, params: dict, data: dict
) -> dict | list:
    """
    Выполняет стандартный POST-запрос к API ЕМИАС и возвращает JSON-ответ.
    """
    response = await http_service.fetch(
        url=settings.BASE_URL,
        method="POST",
        cookies=cookies,
        headers=HEADERS,
        params=params,
        data=data,
        raise_for_status=True,
    )
    return response.get("json")


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_person_data(
    cookies: dict[str, str], http_service: HTTPXClient, person_id: str
) -> dict:
    """
    Загружает основные данные о пациенте по его ID.
    """
    params = {"c": "Common", "m": "loadPersonData"}
    data = {"Person_id": person_id, "LoadShort": True, "mode": "PersonInfoPanel"}

    response_json = await _make_api_post_request(cookies, http_service, params, data)
    return response_json[0] if isinstance(response_json, list) and response_json else {}


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_movement_data(
    cookies: dict[str, str], http_service: HTTPXClient, event_id: str
) -> dict:
    """
    Загружает данные о движении пациента в рамках случая госпитализации.
    """
    params = {"c": "EvnSection", "m": "loadEvnSectionGrid"}
    data = {
        "EvnSection_pid": event_id,
    }

    response_json = await _make_api_post_request(cookies, http_service, params, data)
    return response_json[0] if isinstance(response_json, list) and response_json else {}


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_referral_data(
    cookies: dict[str, str], http_service: HTTPXClient, event_id: str
) -> dict:
    """
    Загружает данные о направлении на госпитализацию.
    """
    params = {"c": "EvnPS", "m": "loadEvnPSEditForm"}
    data = {
        "EvnPS_id": event_id,
        "archiveRecord": "0",
        "delDocsView": "0",
        "attrObjects": [{"object": "EvnPSEditWindow", "identField": "EvnPS_id"}],
    }

    response_json = await _make_api_post_request(cookies, http_service, params, data)
    return response_json[0] if isinstance(response_json, list) and response_json else {}


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_disease_data(
    cookies: dict[str, str],
    http_service: HTTPXClient,
    data: dict,
) -> dict:
    """
    Загружает данные о заболевании из раздела случая госпитализации.
    """
    event_section_id = data.get("EvnSection_id", "")

    params = {"c": "EvnSection", "m": "loadEvnSectionEditForm"}
    data = {
        "EvnSection_id": event_section_id,
        "archiveRecord": "0",
        "attrObjects": [
            {"object": "EvnSectionEditWindow", "identField": "EvnSection_id"}
        ],
    }

    response_json = await _make_api_post_request(cookies, http_service, params, data)

    if not isinstance(response_json, dict):
        return {}

    fields_data = response_json.get("fieldsData", [])
    return fields_data[0] if isinstance(fields_data, list) and fields_data else {}


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_referred_org_by_id(
    cookies: dict[str, str], http_service: HTTPXClient, org_id: str
) -> dict:
    """
    Получает информацию о направившей организации по её ID.
    """
    params = {"c": "Org", "m": "getOrgList"}
    data = {
        "Org_id": org_id,
    }

    response_json = await _make_api_post_request(cookies, http_service, params, data)
    return response_json[0] if isinstance(response_json, list) and response_json else {}


# ============== Начало - Получаем только операции (если они есть) из списка оказанных услуг ==============


async def _fetch_all_medical_services(
    cookies: dict[str, str], http_service: HTTPXClient, event_id: str
) -> List[Dict[str, Any]]:
    """
    Получает список ВСЕХ оказанных услуг в рамках случая госпитализации.
    """
    params = {"c": "EvnUsluga", "m": "loadEvnUslugaGrid"}
    data = {"pid": event_id, "parent": "EvnPS"}

    services = await _make_api_post_request(cookies, http_service, params, data)

    if not isinstance(services, list):
        logger.warning(
            f"event_id: {event_id}, API услуг вернул не список: {type(services)}"
        )
        return []

    return services


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_operations_data(
    cookies: dict[str, str], http_service: HTTPXClient, event_id: str
) -> list[dict[str, str]]:
    """
    Находит и возвращает список операций среди всех услуг,
    оказанных пациенту в рамках госпитализации, если их нет возвращается пустой список.
    """
    services = await _fetch_all_medical_services(cookies, http_service, event_id)
    operations = filter_operations_from_services(services)

    if operations:
        logger.debug(f"event_id: {event_id}, найдено операций: {len(operations)}")
    else:
        logger.warning(
            f"event_id: {event_id}, операции не найдены в списке из {len(services)} услуг."
        )

    return operations


# ============== Конец - Получаем только операции (если они есть) из списка оказанных услуг ==============

# ============== Начало - Получаем дополнительные диагнозы (если они есть) из движения в ЕВМИАС ==========


async def _fetch_raw_diagnosis_list(
    cookies: dict[str, str], http_service: HTTPXClient, diagnosis_id: str
) -> List[Dict[str, str]]:
    """
    Получает "сырой" список диагнозов от API.
    """
    params = {"c": "EvnDiag", "m": "loadEvnDiagPSGrid"}
    data = {"class": "EvnDiagPSSect", "EvnDiagPS_pid": diagnosis_id}
    diagnosis_list = await _make_api_post_request(cookies, http_service, params, data)

    if not isinstance(diagnosis_list, list):
        logger.warning(
            f"EvnSection_id: {diagnosis_id}, API вернул не список: {type(diagnosis_list)}"
        )
        return []
    return diagnosis_list


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_additional_diagnosis(
    cookies: dict[str, str], http_service: HTTPXClient, diagnosis_id: str
) -> list[dict[str, str]]:
    """
    Получает список дополнительных диагнозов из движения в ЕВМИАС, если они есть,
    и возвращает их в виде списка словарей.
    """
    if not diagnosis_id:
        logger.info(
            "Отсутствует ID для запроса дополнительных диагнозов (diagnosis_id)."
        )
        return []

    raw_diagnosis_list = await _fetch_raw_diagnosis_list(
        cookies, http_service, diagnosis_id
    )
    processed_diagnoses = process_diagnosis_list(raw_diagnosis_list)

    if processed_diagnoses:
        logger.debug(
            f"EvnSection_id: {diagnosis_id}, найдено доп. диагнозов: {len(processed_diagnoses)}"
        )
    else:
        logger.info(f"EvnSection_id: {diagnosis_id}, доп. диагнозы не найдены")

    return processed_diagnoses


# ============== Конец - Получаем дополнительные диагнозы (если они есть) из движения в ЕВМИАС ==========


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_patient_discharge_summary(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        event_id: str,
) -> Dict[str, Any] | None:
    """
    Выполняет многоступенчатый процесс получения и обработки данных из выписного эпикриза.
    """
    logger.info(f"Начинаем получать данные из выписного эпикриза для event_id: {event_id}")

    # ===== Шаг 1. Получаем id раздела события для запроса списка медицинских записей =====================
    params = {"c": "EvnSection", "m": "loadEvnSectionGrid"}
    data = {"EvnSection_pid": event_id}
    section_data = await _make_api_post_request(cookies, http_service, params, data)

    if section_data and isinstance(section_data, list):
        event_section_id = section_data[0].get("EvnSection_id", "")
    else:
        event_section_id = None

    if not event_section_id:
        logger.warning(f"Не удалось получить EvnSection_id для event_id: {event_id}. Поиск эпикриза прерван.")
        return None
    logger.debug(f"Шаг 1/5: Получен EvnSection_id: {event_section_id}")

    # ===== Шаг 2. Получаем список медицинских записей пациента в рамках госпитализации =====================
    params = {"c": "EvnXml6E", "m": "loadStacEvnXmlList", "_dc": datetime.now().timestamp()}
    data = {"Evn_id": event_section_id}
    medical_records = await _make_api_post_request(cookies, http_service, params, data)

    if not isinstance(medical_records, list):
        logger.warning(f"API вернул не список медицинских записей: {type(medical_records)}. Поиск эпикриза прерван.")
        return None
    logger.debug(f"Шаг 2/5: Получено {len(medical_records)} медицинских записей")

    # ===== Шаг 3. Получаем из списка медицинских записей непосредственно сам выписной эпикриз =====================
    discharge_summary_entry = None
    for entry in medical_records:
        if (entry.get("XmlType_Name") == "Эпикриз") and (entry.get("XmlTypeKind_Name") == "Выписной"):
            discharge_summary_entry = entry
            break

    if not discharge_summary_entry:
        logger.info(f"Не удалось найти выписной эпикриз для event_id: {event_id} среди {len(medical_records)} записей.")
        return None
    logger.debug("Шаг 3/5: Найден выписной эпикриз")

    # ===== Шаг 4. Получаем 'сырые' данные выписного эпикриза =====================
    params = {"c": "XmlTemplate6E", "m": "getXmlTemplateForEvnXml", "_dc": datetime.now().timestamp()}
    data = {
        "Evn_id": discharge_summary_entry.get("EvnXml_pid", ""),
        "EvnXml_id": discharge_summary_entry.get("EMDRegistry_ObjectID", ""),
    }

    if not all(data.values()):
        logger.warning(f"В записи эпикриза отсутствуют необходимые id: {data}. Поиск эпикриза прерван.")
        return None

    raw_discharge_summary_data = await _make_api_post_request(cookies, http_service, params, data)
    if not isinstance(raw_discharge_summary_data, dict) or "xmlData" not in raw_discharge_summary_data:
        logger.warning(f"Получены некорректные сырые данные для эпикриза: {raw_discharge_summary_data}.")
        return None
    logger.debug(f"Шаг 4/5: Получены сырые данные для выписного эпикриза.")

    # ===== Шаг 5. Извлекаем и структурируем необходимые данные по выписному эпикризу =====================
    xml_data = raw_discharge_summary_data.get("xmlData", {})
    template_raw = raw_discharge_summary_data.get("template", "")

    pattern = r"Сопутствующие заболевания:\s*<br>\s*(.*?)(?=<\/)"
    concomitant_match = re.search(pattern, template_raw, re.DOTALL)

    pattern = r"Осложнения основного заболевания:\s*(.*?)(?=<\/)"
    complication_match = re.search(pattern, template_raw, re.DOTALL)

    result = {
        "pure": {
            "diagnos": xml_data.get("diagnos"),
            "item_90": xml_data.get("specMarker_90"),
            "item_94": xml_data.get("specMarker_94"),
            "item_272": xml_data.get("specMarker_272"),
            "item_284": xml_data.get("specMarker_284"),
            "item_659": xml_data.get("specMarker_659"),
            "concomitant_diseases": concomitant_match.group(1).strip() if concomitant_match else None,
            "primary_complication": complication_match.group(1).strip() if complication_match else None,
        },
        "raw": raw_discharge_summary_data,
    }

    logger.info(f"Шаг 5/5: Эпикриз успешно обработан для event_id: {event_id}.")
    return result
