from datetime import datetime
from typing import List, Dict, Any

from fastapi import HTTPException

from app.model import ExtensionStartedData
from app.core import get_settings, HTTPXClient, get_http_service, logger

settings = get_settings()

SEARCH_PERIOD_START_DATE = settings.SEARCH_PERIOD_START_DATE



async def fetch_started_data(
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
        "PayType_id": patient.pay_type_id or settings.SEARCH_PAY_TYPE_ID,
        "LpuBuilding_cid": settings.SEARCH_LPU_BUILDING_CID,
        "EvnSection_disDate_Range": patient.dis_date_range or f"{SEARCH_PERIOD_START_DATE} - {datetime.now().strftime('%d.%m.%Y')}",
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