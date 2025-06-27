from app.core import get_settings, HTTPXClient, logger
from app.core.decorators import log_and_catch

settings = get_settings()
HEADERS = {"Origin": settings.BASE_HEADERS_ORIGIN_URL, "Referer": settings.BASE_HEADERS_REFERER_URL}


async def _make_api_post_request(http_service: HTTPXClient, cookies: dict, params: dict, data: dict) -> dict | list:
    """Выполняет стандартный POST-запрос к API ЕМИАС и возвращает JSON-ответ."""
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
        cookies: dict[str, str],
        http_service: HTTPXClient,
        person_id: str
) -> dict:
    """
    Загружает основные данные о пациенте по его ID.

    Returns:
        Словарь с данными пациента или пустой словарь в случае ошибки.
    """
    params = {"c": "Common", "m": "loadPersonData"}
    data = {
        "Person_id": person_id,
        "LoadShort": True,
        "mode": "PersonInfoPanel"
    }

    response_json = await _make_api_post_request(http_service, cookies, params, data)
    return response_json[0] if isinstance(response_json, list) and response_json else {}


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_movement_data(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        event_id: str
) -> dict:
    """
    Загружает данные о движении пациента в рамках случая госпитализации.

    Returns:
        Словарь с данными о движении или пустой словарь в случае ошибки.
    """
    params = {"c": "EvnSection", "m": "loadEvnSectionGrid"}
    data = {
        "EvnSection_pid": event_id,
    }

    response_json = await _make_api_post_request(http_service, cookies, params, data)
    return response_json[0] if isinstance(response_json, list) and response_json else {}


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_referral_data(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        event_id: str
) -> dict:
    """
    Загружает данные о направлении на госпитализацию.

    Returns:
        Словарь с данными о направлении или пустой словарь в случае ошибки.
    """
    params = {"c": "EvnPS", "m": "loadEvnPSEditForm"}
    data = {
        "EvnPS_id": event_id,
        "archiveRecord": "0",
        "delDocsView": "0",
        "attrObjects": [{"object": "EvnPSEditWindow", "identField": "EvnPS_id"}],
    }

    response_json = await _make_api_post_request(http_service, cookies, params, data)
    return response_json[0] if isinstance(response_json, list) and response_json else {}


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_disease_data(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        data: dict,
) -> dict:
    """
    Загружает данные о заболевании из раздела случая госпитализации.

    Returns:
        Словарь с данными о заболевании или пустой словарь в случае ошибки.
    """
    event_section_id = data.get("EvnSection_id", "")

    params = {"c": "EvnSection", "m": "loadEvnSectionEditForm"}
    data = {
        "EvnSection_id": event_section_id,
        "archiveRecord": "0",
        "attrObjects": [{"object": "EvnSectionEditWindow", "identField": "EvnSection_id"}],
    }

    response_json = await _make_api_post_request(http_service, cookies, params, data)

    if not isinstance(response_json, dict):
        return {}

    fields_data = response_json.get("fieldsData", [])
    return fields_data[0] if isinstance(fields_data, list) and fields_data else {}


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_referred_org_by_id(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        org_id: str
) -> dict:
    """
   Получает информацию о направившей организации по её ID.

   Returns:
    Словарь с данными об организации или пустой словарь в случае ошибки.
   """
    params = {"c": "Org", "m": "getOrgList"}
    data = {
        "Org_id": org_id,
    }

    response_json = await _make_api_post_request(http_service, cookies, params, data)
    return response_json[0] if isinstance(response_json, list) and response_json else {}


def _sanitize_medical_service_entry(entry: dict) -> dict[str, str]:
    """
     Извлекает ключевые данные из записи об услуге и возвращает
    их в виде структурированного словаря.
    """
    return {
        "code": entry.get("Usluga_Code", "").strip(),
        "name": entry.get("Usluga_Name", "").strip(),
    } if entry.get("Usluga_Code") else {}


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_medical_service_data(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        event_id: str
) -> list[dict[str, str]]:
    """
    Находит и возвращает список операций среди всех услуг,
    оказанных пациенту в рамках госпитализации.
    """
    params = {"c": "EvnUsluga", "m": "loadEvnUslugaGrid"}
    data = {
        "pid": event_id,
        "parent": "EvnPS"
    }

    services_list = await _make_api_post_request(http_service, cookies, params, data)

    if not isinstance(services_list, list):
        logger.warning(f"event_id: {event_id}, API вернул не список: {type(services_list)}")
        return []

    operations_found = []
    for entry in services_list:
        # EvnUslugaOper — системный идентификатор услуги, которая является операцией
        service_type = entry.get("EvnClass_SysNick", "")
        if isinstance(entry, dict) and "EvnUslugaOper" in service_type:
            sanitized_entry = _sanitize_medical_service_entry(entry)
            if sanitized_entry:
                operations_found.append(sanitized_entry)

    if operations_found:
        logger.debug(f"event_id: {event_id}, найдено операций: {len(operations_found)}")
    else:
        logger.warning(f"event_id: {event_id}, операции не найдены")

    return operations_found


def _sanitize_additional_diagnosis_entry(entry: dict) -> dict[str, str]:
    """
     Извлекает ключевые данные из записи о дополнительном диагнозе и возвращает
    их в виде структурированного словаря.
    """
    return {
        "code": entry.get("Diag_Code", "").strip(),
        "name": entry.get("Diag_Name", "").strip(),
    } if entry.get("Diag_Code") else {}


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_additional_diagnosis(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        diagnosis_id: str
) -> list[dict[str, str]]:
    if not diagnosis_id:
        logger.info("Отсутствует ID для запроса дополнительных диагнозов (diagnosis_id).")
        return []

    params = {"c": "EvnDiag", "m": "loadEvnDiagPSGrid"}

    data = {
        "class": "EvnDiagPSSect",
        "EvnDiagPS_pid": diagnosis_id,
    }

    diagnosis_list = await _make_api_post_request(http_service, cookies, params, data)

    if not isinstance(diagnosis_list, list):
        logger.warning(f"EvnSection_id: {diagnosis_id}, API вернул не список: {type(diagnosis_list)}")
        return []

    diagnosis_found = []
    for entry in diagnosis_list:
        if isinstance(entry, dict):
            sanitized_entry = _sanitize_additional_diagnosis_entry(entry)
            if sanitized_entry:
                diagnosis_found.append(sanitized_entry)

    if diagnosis_found:
        logger.debug(f"EvnSection_id: {diagnosis_id}, найдено доп. диагнозов: {len(diagnosis_found)}")
    else:
        logger.info(f"EvnSection_id: {diagnosis_id}, доп. диагнозы не найдены")

    return diagnosis_found
