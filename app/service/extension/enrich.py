from typing import Annotated, Dict, Any

from fastapi import Depends

from app.core import HTTPXClient, get_http_service, logger
from app.model import EnrichmentRequestData
from app.service import set_cookies
from app.service.evmias.request import (
    fetch_person_data,
    fetch_movement_data,
    fetch_referral_data,
    fetch_disease_data,
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
)


async def enrich_data(
        enrich_request: EnrichmentRequestData,
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)]
) -> Dict[str, Any]:
    logger.info(f"Запрос на обогащение получен.")

    # Извлекаем некоторые данные из original_evmias_data для примера
    started_data = enrich_request.started_data
    person_id = started_data.get("Person_id")
    event_id = started_data.get("EvnPS_id")
    logger.debug(f"Извлечены данные: person_id={person_id}, event_id={event_id}")

    person_dara = await fetch_person_data(cookies, http_service, person_id)
    movement_data = await fetch_movement_data(cookies, http_service, event_id)
    referred_data = await fetch_referral_data(cookies, http_service, event_id)

    referred_organization = await get_referred_organization(cookies, http_service, referred_data)

    # получаем EvnSection_id для запроса получения id исхода заболевания (outcome_code)
    event_section_id = movement_data.get("EvnSection_id", "")
    disease_data = await fetch_disease_data(cookies, http_service, event_section_id)
    outcome_code = await get_outcome_code(disease_data)
    disease_type_code = await get_disease_type_code(disease_data)

    bed_profile_name = movement_data.get("LpuSectionBedProfile_Name", "")
    bed_profile_code = await get_bed_profile_code(bed_profile_name)

    polis_number = person_dara.get("Person_EdNum", "")
    person_birthday = started_data.get("Person_Birthday", "")
    gender = person_dara.get("Sex_Name", "")

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
        "input[name='ReferralHospitalizationSendingDepartment']": referred_organization
    }

    return enriched_data
