from typing import List, Dict, Any, Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import get_settings, HTTPXClient, get_http_service, logger
from app.core.decorators import route_handler
from app.model import ExtensionStartedData, EnrichmentRequestData
from app.service import (
    set_cookies,
    fetch_started_data,
    enrich_data,
)

settings = get_settings()

router = APIRouter(prefix="/extension", tags=["Расширение"])

SEARCH_PERIOD_START_DATE = settings.SEARCH_PERIOD_START_DATE


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
    result = await fetch_started_data(patient=patient, cookies=cookies, http_service=http_service)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Данные не найдены"
        )
    return result


@route_handler(debug=settings.DEBUG_ROUTE)
@router.post(
    path="/enrich-data",
    summary="Обогатить данные для фронта",
    description="Обогатить данные для фронта",
    response_model=Dict[str, Any]
)
async def enrich_started_data_for_front(
        enrich_request: EnrichmentRequestData,
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)]
) -> Dict[str, Any]:
    """
    Обогатить данные для фронта
    """
    result = await enrich_data(enrich_request, cookies, http_service)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Не удалось обогатить данные"
        )
    return result
