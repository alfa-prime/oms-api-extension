from typing import Annotated

from fastapi import APIRouter, Depends, Path, Body

from app.core import get_settings, HTTPXClient, get_http_service
from app.core.decorators import route_handler
from app.service import (
    set_cookies,
    fetch_person_data,
    fetch_movement_data,
    fetch_referral_data,
    fetch_referred_org_by_id,
    fetch_medical_service_data
)

settings = get_settings()
HEADERS = {"Origin": settings.BASE_HEADERS_ORIGIN_URL, "Referer": settings.BASE_HEADERS_REFERER_URL}

router = APIRouter(prefix="/evmias", tags=["ЕВМИАС"])


@route_handler(debug=settings.DEBUG_ROUTE)
@router.get(
    path="/person/{person_id}",
    summary="Получение базовой информации о пациенте",
    description="Получение базовой информации о пациенте",
)
async def person_by_id(
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)],
        person_id: str = Path(..., description="id пациента")
):
    response = await fetch_person_data(
        cookies=cookies,
        http_service=http_service,
        person_id=person_id
    )
    return response


@route_handler(debug=settings.DEBUG_ROUTE)
@router.get(
    path="/hosp/{event_id}",
    summary="Получение информации о конкретной госпитализации",
    description="Получение информации о конкретной госпитализации",
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
)
async def movement_by_event_id(
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)],
        event_id: str = Path(..., description="id события")
):
    response = await fetch_movement_data(
        cookies=cookies,
        http_service=http_service,
        event_id=event_id
    )
    return response


@route_handler(debug=settings.DEBUG_ROUTE)
@router.get(
    path="/referred/{event_id}",
    summary="Получение данных о направлении пациента",
    description="Получение данных о направлении пациента",
)
async def get_referred(
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)],
        event_id: str = Path(..., description="id события")
):
    response = await fetch_referral_data(
        cookies=cookies,
        http_service=http_service,
        event_id=event_id
    )
    return response


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


@router.post("/person_panel")
async def _get_polis(
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)],
        person_id: str = Body(..., description="ID пациента"),
        server_id: str = Body(..., description="ID сервера"),
):
    url = settings.BASE_URL
    headers = HEADERS

    params = {"c": "Person", "m": "getPersonEditWindow"}

    data = {
        "person_id": person_id,
        "server_id": server_id,
        "attrObjects": "true",
        "mode": [{"object": "PersonEditWindow", "identField": "Person_id"}],
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


@router.get(
    path="/result_disease",
    summary="исход заболевания"
)
async def result_disease(
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)],
):
    url = settings.BASE_URL
    headers = HEADERS

    params = {
        "c": "MongoDBWork",
        "m": "getData",
        "object": "ResultDesease",
    }

    data = {
        "ResultDesease_id": "",
        "ResultDesease_Code": "",
        "ResultDesease_Name": "",
        "object": "ResultDesease",
    }

    response = await http_service.fetch(
        url=url,
        method="POST",
        cookies=cookies,
        headers=headers,
        params=params,
        data=data,
    )

    response_json = response.get("json", {})
    result = {}
    for item in response_json:
        id_ = item["ResultDesease_id"]
        name = item["ResultDesease_Name"]
        code = item["ResultDesease_Code"]
        result[id_] = {"name": name, "code": code}

    return result


@router.get(
    path="/event_section/{event_id}",
    summary="Получение информации по id госпитализации"
)
async def get_event_by_id(
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)],
        event_id: str = Path(..., description="id события")
):
    url = settings.BASE_URL
    headers = HEADERS
    params = {"c": "EvnSection", "m": "loadEvnSectionEditForm"}
    data = {
        "EvnSection_id": event_id,
        "archiveRecord": "0",
        "attrObjects": [{"object": "EvnSectionEditWindow", "identField": "EvnSection_id"}],
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


@router.get(
    path="/org/{org_id}",
    summary="Получение направившей организации по id"
)
async def get_event_by_id(
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)],
        org_id: str = Path(..., description="id организации")
):
    return await fetch_referred_org_by_id(cookies=cookies, http_service=http_service, org_id=org_id)


@router.get(
    path="/services/{event_id}",
    summary="Получение списка услуг пациента по id госпитализации"
)
async def get_medical_services(
        cookies: Annotated[dict[str, str], Depends(set_cookies)],
        http_service: Annotated[HTTPXClient, Depends(get_http_service)],
        event_id: str = Path(..., description="id организации")
):
    return await fetch_medical_service_data(cookies=cookies, http_service=http_service, event_id=event_id)
