from datetime import datetime
from typing import List, Dict, Any, Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import get_settings, HTTPXClient, get_http_service, logger
from app.core.decorators import route_handler
from app.model import ExtensionStartedData, EnrichmentRequestData
from app.service import (
    set_cookies,
    get_medical_care_condition,
    get_medical_care_form,
    get_direction_date,
    get_bed_profile_code,
    fetch_person_data,
    fetch_movement_data,
    fetch_referral_data,
    fetch_disease_outcome_code_and_disease_type_code,
)

settings = get_settings()

router = APIRouter(prefix="/extension", tags=["Расширение"])

SEARCH_PERIOD_START_DATE = settings.SEARCH_PERIOD_START_DATE


async def _fetch_data(
        patient: ExtensionStartedData,
        cookies: dict[str, str],
        http_service: HTTPXClient
) -> List[Dict[str, Any]]:
    """Выполняет поиск по заданным параметрам в ЕВМИАС и возвращает список пациентов с госпитализациями"""
    url = settings.BASE_URL
    headers = {"Origin": settings.BASE_HEADERS_ORIGIN_URL, "Referer": settings.BASE_HEADERS_REFERER_URL}
    params = {"c": "Search", "m": "searchData"}
    data = {
        "SearchFormType": "EvnPS",
        "Person_Surname": patient.last_name,
        "PayType_id": 3010101000000048,
        "LpuBuilding_cid": "3010101000000467",
        "EvnSection_disDate_Range": patient.dis_date_range or f"{SEARCH_PERIOD_START_DATE} - {datetime.now().strftime('%d.%m.%Y')}",
        # Добавляем опциональные поля, если они не пустые, используя := и **
        **({"Person_Firname": first_name} if (first_name := patient.first_name) else {}),
        **({"Person_Secname": middle_name} if (middle_name := patient.middle_name) else {}),
        **({"Person_Birthday": birthday} if (birthday := patient.birthday) else {}),
    }

    logger.debug(f"Поиск госпитализаций пациента с параметрами: {data}")

    response = await http_service.fetch(
        url=url,
        method="POST",
        cookies=cookies,
        headers=headers,
        params=params,
        data=data
    )

    if not isinstance(response, dict):
        logger.error(f"Ответ не словарь: {response}")
        raise HTTPException(status_code=502, detail="Неверный формат ответа от внешней системы")

    json_data = response.get("json")
    if not isinstance(json_data, dict):
        logger.error(f"Нет ключа 'json' или он не словарь: {response}")
        raise HTTPException(status_code=502, detail="Некорректный JSON в ответе от внешней системы")

    data = json_data.get("data")
    if not isinstance(data, list):
        logger.error(f"Ожидался список в ключе 'data', но получено: {type(data)}")
        raise HTTPException(status_code=502, detail="Невалидный формат данных от внешней системы")

    return data


@route_handler(debug=settings.DEBUG_ROUTE)
@router.post(
    path="/search",
    summary="Получить список пациентов по фильтру",
    description="Получить список пациентов по фильтру",
)
async def search_patients_hospitals(
        patient: ExtensionStartedData,
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)]
) -> List[Dict[str, Any]]:
    """
    Получить список госпитализаций пациентов по фильтру
    """
    logger.info("Запрос на поиск пациентов")
    result = await _fetch_data(patient=patient, cookies=cookies, http_service=http_service)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Данные не найдены"
        )

    return result


@route_handler(debug=settings.DEBUG_ROUTE)
@router.post(
    path="/enrich-data",
    summary="Обогатить данных для фронта",
    description="Обогатить данных для фронта",
    response_model=Dict[str, Any]
)
async def enrich_started_data_for_front(
        enrich_request: EnrichmentRequestData,
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)]
) -> Dict[str, Any]:
    """
    Получить список госпитализаций пациентов по фильтру
    """
    logger.info(
        f"Запрос на обогащение получен. original_evmias_data: {enrich_request.started_data}")
    if enrich_request.medical_orgs_list:
        logger.info(f"Получено МО: {len(enrich_request.medical_orgs_list)} записей.")
    else:
        logger.info("Список МО не передан.")

    # Извлекаем некоторые данные из original_evmias_data для примера
    started_data = enrich_request.started_data
    person_id = started_data.get("Person_id")
    event_id = started_data.get("EvnPS_id")
    person_dara = await fetch_person_data(cookies, http_service, person_id)
    movement_data = await fetch_movement_data(cookies, http_service, event_id)
    referred_data = await fetch_referral_data(cookies, http_service, event_id)

    # получаем EvnSection_id для запроса получения id исхода заболевания (outcome_code)
    event_section_id = movement_data.get("EvnSection_id", "")
    outcome_code, disease_type_code = \
        await fetch_disease_outcome_code_and_disease_type_code(cookies, http_service, event_section_id)

    bed_profile_name = movement_data.get("LpuSectionBedProfile_Name", "")
    bed_profile_code = await get_bed_profile_code(bed_profile_name)

    gender = person_dara.get("Sex_Name", "")
    polis_number = person_dara.get("Person_EdNum", "")
    admission_date = started_data.get("EvnPS_setDate")
    direction_date = await get_direction_date(admission_date)
    discharge_date = started_data.get("EvnPS_disDate")
    person_birthday = started_data.get("Person_Birthday", "")
    department_name = started_data.get("LpuSection_Name", "")

    medical_care_conditions = await get_medical_care_condition(department_name)
    medical_care_form = await get_medical_care_form(referred_data)

    diag_code = movement_data.get("Diag_Code")
    card_number = started_data.get("EvnPS_NumCard", "").split(" ")[0]
    treatment_outcome_code = movement_data.get("LeaveType_Code")

    enriched_data = {
        "input[name='ReferralHospitalizationNumberTicket']": "б/н",
        "input[name='ReferralHospitalizationDateTicket']": direction_date,
        "input[name='ReferralHospitalizationMedIndications']": "001",
        "input[name='Enp']": polis_number,
        "input[name='DateBirth']": person_birthday,
        "input[name='Gender']": gender,
        "input[name='TreatmentDateStart']": admission_date,
        "input[name='TreatmentDateEnd']": discharge_date,
        "input[name='VidMpV008']": "31",
        "input[name='HospitalizationInfoV006']": medical_care_conditions,\
        "input[name='HospitalizationInfoV014']": medical_care_form,
        "input[name='HospitalizationInfoSubdivision']": "Стационар",
        "input[name='HospitalizationInfoNameDepartment']": department_name,
        "input[name='HospitalizationInfoV020']": bed_profile_code,
        "input[name='HospitalizationInfoDiagnosisMainDisease']": diag_code,
        "input[name='CardNumber']": card_number,
        "input[name='ResultV009']": treatment_outcome_code,
        "input[name='IshodV012']": outcome_code,
        "input[name='HospitalizationInfoC_ZABV027']": disease_type_code
    }

    return enriched_data
