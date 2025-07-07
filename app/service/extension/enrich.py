import asyncio
from typing import Annotated, Dict, Any, Awaitable

from fastapi import Depends

from app.core import HTTPXClient, get_http_service, logger
from app.model import EnrichmentRequestData
from app.service import set_cookies
from app.service.evmias.request import (
    fetch_person_data,
    fetch_movement_data,
    fetch_referral_data,
    fetch_disease_data,
    fetch_operations_data,
    fetch_additional_diagnosis,
    fetch_patient_discharge_summary,

)
from app.service.extension.helpers import (
    get_referred_organization,
    get_medical_care_condition,
    get_medical_care_form,
    get_direction_date,
    get_bed_profile_code,
    get_outcome_code,
    get_disease_type_code,
    get_department_name,
    get_department_code,
    get_medical_care_profile,
    get_valid_additional_diagnosis,
)


async def _safe_gather(*tasks: Awaitable[Any]) -> list[Any | None]:
    """
    Безопасно выполняет несколько асинхронных задач параллельно.

    Каждая задача (coroutine) выполняется через asyncio.gather. Если задача завершилась с исключением,
    оно логируется, а в итоговый список вместо результата добавляется None.

    Это позволяет продолжить выполнение даже если одна или несколько задач упали.

    :param tasks: Набор асинхронных функций (без await).
    :return: Список результатов — либо результат задачи, либо None, если она упала.
    """
    # Выполняем все задачи параллельно, исключения не прерывают выполнение
    results = await asyncio.gather(*tasks, return_exceptions=True)
    clean_results = []

    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.exception(f"Задача #{i + 1} завершилась с ошибкой: {type(result).__name__} — {result}")
            clean_results.append(None)
        else:
            clean_results.append(result)

    return clean_results


async def _fetch_and_process_additional_diagnosis(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        referred_data: dict[str, Any] | None
) -> list[dict[str, str]]:
    """
    Получает и фильтрует дополнительные диагнозы по МКБ E10/E11 (сахарный диабет)..
    """
    if not referred_data:
        logger.info("Нет данных о направлении (referred_data), пропускаем запрос доп. диагнозов.")
        return []

    evn_section_id = referred_data.get("ChildEvnSection_id")
    if not evn_section_id:
        logger.warning("В данных о направлении отсутствует ChildEvnSection_id, невозможно получить доп. диагнозы.")
        return []

    logger.debug(f"Запрашиваем дополнительные диагнозы для evn_section_id: {evn_section_id}")
    additional_diagnosis_data = await fetch_additional_diagnosis(cookies, http_service, evn_section_id)

    valid_additional_diagnosis = await get_valid_additional_diagnosis(additional_diagnosis_data)
    logger.info(f"Найдено {len(valid_additional_diagnosis)} валидных доп. диагнозов по фильтру.")

    return valid_additional_diagnosis


async def enrich_data(
        enrich_request: EnrichmentRequestData,
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)]
) -> Dict[str, Any]:
    logger.info(f"Запрос на обогащение получен.")

    started_data = enrich_request.started_data
    person_id = started_data.get("Person_id")
    event_id = started_data.get("EvnPS_id")
    logger.debug(f"Извлечены данные: person_id={person_id}, event_id={event_id}")

    results = await _safe_gather(
        fetch_person_data(cookies, http_service, person_id),
        fetch_movement_data(cookies, http_service, event_id),
        fetch_referral_data(cookies, http_service, event_id),
        fetch_operations_data(cookies, http_service, event_id),
        fetch_patient_discharge_summary(cookies, http_service, event_id),

    )
    person_data, movement_data, referred_data, medical_service_data, discharge_summary = results

    person_data = person_data or {}
    movement_data = movement_data or {}
    referred_data = referred_data or {}
    medical_service_data = medical_service_data or []
    pure_discharge_summary = discharge_summary.get("pure") if discharge_summary else {}

    logger.warning(f"ЭПИКРИЗ: {pure_discharge_summary}")

    valid_additional_diagnosis = await _fetch_and_process_additional_diagnosis(cookies, http_service, referred_data)

    referred_organization = await get_referred_organization(cookies, http_service, referred_data)
    disease_data = await fetch_disease_data(cookies, http_service, movement_data)

    outcome_code = await get_outcome_code(disease_data)
    disease_type_code = await get_disease_type_code(disease_data)

    bed_profile_name = movement_data.get("LpuSectionBedProfile_Name", "")
    bed_profile_code = await get_bed_profile_code(bed_profile_name)

    polis_number = person_data.get("Person_EdNum", "")
    person_birthday = started_data.get("Person_Birthday", "")
    gender = person_data.get("Sex_Name", "")

    admission_date = started_data.get("EvnPS_setDate")
    direction_date = await get_direction_date(admission_date)
    discharge_date = started_data.get("EvnPS_disDate")

    department_name = await get_department_name(started_data)
    department_code = await get_department_code(department_name)

    medical_care_conditions = await get_medical_care_condition(department_name)
    medical_care_form = await get_medical_care_form(referred_data)
    medical_care_profile = await get_medical_care_profile(movement_data)

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
        "input[name='HospitalizationInfoV006']": medical_care_conditions,
        "input[name='HospitalizationInfoV014']": medical_care_form,
        "input[name='HospitalizationInfoSpecializedMedicalProfile']": medical_care_profile,
        "input[name='HospitalizationInfoSubdivision']": "Стационар",
        "input[name='HospitalizationInfoNameDepartment']": department_name,
        "input[name='HospitalizationInfoOfficeCode']": department_code,
        "input[name='HospitalizationInfoV020']": bed_profile_code,
        "input[name='HospitalizationInfoDiagnosisMainDisease']": diag_code,
        "input[name='CardNumber']": card_number,
        "input[name='ResultV009']": treatment_outcome_code,
        "input[name='IshodV012']": outcome_code,
        "input[name='HospitalizationInfoC_ZABV027']": disease_type_code,
        "input[name='ReferralHospitalizationSendingDepartment']": referred_organization,
        "additional_diagnosis_data": valid_additional_diagnosis,
        "medical_service_data": medical_service_data,
        "discharge_summary": pure_discharge_summary,
    }

    return enriched_data
