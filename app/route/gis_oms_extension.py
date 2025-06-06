from datetime import datetime
from typing import List, Dict, Any, Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import get_settings, HTTPXClient, get_http_service, logger
from app.core.decorators import route_handler
from app.model import ExtensionStartedData
from app.service import set_cookies

settings = get_settings()

router = APIRouter(prefix="/oms-browser-extension", tags=["endpoint для браузерного расширения"])

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
    responses={
        200: {"description": "Успешный ответ с данными"},
        404: {"description": "Данные не найдены"},
        500: {"description": "Внутренняя ошибка сервера"},
        502: {"description": "Ошибка при получении данных от внешней системы (ЕВМИАС)"}
    }
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


    url = 'https://gisoms.ffoms.gov.ru/FFOMS/action/ReferralHospitalization/ListMo'



    return result

# @route_handler(debug=settings.DEBUG_ROUTE)
# @router.post(
#     path="/extended_search",
#     summary="Получить расширенные сведения о конкретной госпитализации",
#     description="Получить расширенные сведения о конкретной госпитализации",
#     responses={
#         200: {"description": "Успешный ответ с данными"},
#         404: {"description": "Данные не найдены"},
#         500: {"description": "Внутренняя ошибка сервера"},
#         502: {"description": "Ошибка при получении данных от внешней системы (ЕВМИАС)"}
#     }
# )
# async def get_extended_patient_hospital_info(
#         event_id: Field(..., description="Идентификатор госпитализации"),
#         cookies: Annotated[dict[str, str], Depends(set_cookies)],
#         http_service: Annotated[HTTPXClient, Depends(get_http_service)],
# ):
#     """
#     Получить расширенные сведения о конкретной госпитализации
#     """
#     logger.info("Запрос на поиск дополнительных сведений о госпитализации")
#
#     return {
#         "referral_number": "б/н",
#         "referral_org_name": "Городская поликлиника № 1",
#         "referral_date": "03.06.2025",
#         "indication_for_hospitalization": "Нетипичное течение заболевания и (или) отсутствие эффекта"
#     }
