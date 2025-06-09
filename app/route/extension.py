from datetime import datetime
from typing import List, Dict, Any, Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import get_settings, HTTPXClient, get_http_service, logger
from app.core.decorators import route_handler
from app.model import ExtensionStartedData, EnrichmentRequestData
from app.service import set_cookies

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
        # cookies: Annotated[dict[str, str], Depends(set_cookies)],
        # http_service: Annotated[HTTPXClient, Depends(get_http_service)]
) -> Dict[str, Any]:
    """
    Получить список госпитализаций пациентов по фильтру
    """
    logger.info(
        f"[УПРОЩЕННЫЙ] Запрос на обогащение получен. original_evmias_data: {enrich_request.started_data}")
    if enrich_request.medical_orgs_list:
        logger.info(f"[УПРОЩЕННЫЙ] Получено МО: {len(enrich_request.medical_orgs_list)} записей.")
    else:
        logger.info("[УПРОЩЕННЫЙ] Список МО не передан.")

    # Извлекаем некоторые данные из original_evmias_data для примера
    original_data = enrich_request.started_data
    person_birthday = original_data.get("Person_Birthday", "ДР Н/Д")
    card_number = original_data.get("EvnPS_NumCard", "Карта Н/Д")
    lpu_section_name = original_data.get("LpuSection_Name", "Отделение Н/Д")

    # Просто возвращаем заглушку в ожидаемом формате
    # Ключи - это селекторы полей на целевой странице ГИС ОМС
    mock_enriched_data = {
        "input[name='ReferralHospitalizationNumberTicket']": "ЗАГЛУШКА б/н",
        "input[name='ReferralHospitalizationMedIndications']": f"ЗАГЛУШКА Показания",
        "input[name='VidMpV008Code']": "031-ЗАГЛУШКА",
        "input[name='VidMpV008']": "ЗАГЛУШКА спец. мед. помощь",
        "input[name='CardNumber']": card_number,  # Берем из исходных данных
        "input[name='HospitalizationInfoNameDepartment']": lpu_section_name,  # Берем из исходных данных
        "input[name='DateBirth']": person_birthday,  # Если нужно вставить на форму и ДР
    }

    logger.info(f"[УПРОЩЕННЫЙ] Возвращаем заглушку: {mock_enriched_data}")

    return mock_enriched_data
