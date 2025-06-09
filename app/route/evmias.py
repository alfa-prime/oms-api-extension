from typing import Annotated

from fastapi import APIRouter, Depends, Path, Body

from app.core import get_settings, HTTPXClient, get_http_service
from app.core.decorators import route_handler
from app.service import set_cookies

settings = get_settings()
HEADERS = {"Origin": settings.BASE_HEADERS_ORIGIN_URL, "Referer": settings.BASE_HEADERS_REFERER_URL}

router = APIRouter(prefix="/evmias", tags=["ЕВМИАС"])


@route_handler(debug=settings.DEBUG_ROUTE)
@router.get(
    path="/person/{person_id}",
    summary="Получение базовой информации о пациенте",
    description="Получение базовой информации о пациенте",
    responses={
        200: {"description": "Успешный ответ с данными"},
        404: {"description": "Данные не найдены"},
        500: {"description": "Внутренняя ошибка сервера"},
        502: {"description": "Ошибка при получении данных от внешней системы (ЕВМИАС)"}
    }
)
async def person_by_id(
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)],
        person_id: str = Path(..., description="id пациента")
):
    url = settings.BASE_URL
    headers = HEADERS
    params = {"c": "Common", "m": "loadPersonData"}
    data = {
        "Person_id": person_id,
        "LoadShort": True,
        "mode": "PersonInfoPanel"
    }

    response = await http_service.fetch(
        url=url,
        method="POST",
        cookies=cookies,
        headers=headers,
        params=params,
        data=data,
    )
    return response.get("json", {})


@route_handler(debug=settings.DEBUG_ROUTE)
@router.get(
    path="/hosp/{event_id}",
    summary="Получение информации о конкретной госпитализации",
    description="Получение информации о конкретной госпитализации",
    responses={
        200: {"description": "Успешный ответ с данными"},
        404: {"description": "Данные не найдены"},
        500: {"description": "Внутренняя ошибка сервера"},
        502: {"description": "Ошибка при получении данных от внешней системы (ЕВМИАС)"}
    }

)
async def hosp_by_id(
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)],
        event_id: str = Path(..., description="id события")
):
    url = settings.BASE_URL
    headers = HEADERS
    params = {"c": "EvnPS", "m": "loadEvnPSEditForm"}
    data = {
        "EvnPS_id": event_id,
        "archiveRecord": "0",
        "delDocsView": "0",
        "attrObjects": [{"object": "EvnPSEditWindow", "identField": "EvnPS_id"}],
    }

    response = await http_service.fetch(
        url=url,
        method="POST",
        cookies=cookies,
        headers=headers,
        params=params,
        data=data,
    )

    return response.get("json", {})


@route_handler(debug=settings.DEBUG_ROUTE)
@router.get(
    path="/movement/{event_id}",
    summary="Получение данных о движении пациента",
    description="Получение данных о движении пациента",
    responses={
        200: {"description": "Успешный ответ с данными"},
        404: {"description": "Данные не найдены"},
        500: {"description": "Внутренняя ошибка сервера"},
        502: {"description": "Ошибка при получении данных от внешней системы (ЕВМИАС)"}
    }
)
async def smo_name_by_id(
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)],
        event_id: str = Path(..., description="id события")
):
    url = settings.BASE_URL
    headers = HEADERS
    params = {"c": "EvnSection", "m": "loadEvnSectionGrid"}
    data = {
        "EvnSection_pid": event_id,
    }

    response = await http_service.fetch(
        url=url,
        method="POST",
        cookies=cookies,
        headers=headers,
        params=params,
        data=data,
    )
    return response.get("json", {})


@router.post("/evn_section_grid")
async def _get_polis(
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)],
        event_id: str = Body(..., description="ID госпитализации"),
):
    url = settings.BASE_URL
    headers = HEADERS

    params = {"c": "EvnSection", "m": "loadEvnSectionGrid"}

    data = {
        "EvnSection_pid": event_id,
    }

    response = await http_service.fetch(
        url=url,
        method="POST",
        cookies=cookies,
        headers=headers,
        params=params,
        data=data,
        raise_for_status=True  # fetch выкинет HTTPStatusError если не 2xx
    )

    return response.get("json", {})
