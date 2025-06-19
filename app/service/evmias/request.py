from app.core import get_settings, HTTPXClient
from app.core.decorators import log_and_catch

settings = get_settings()
HEADERS = {"Origin": settings.BASE_HEADERS_ORIGIN_URL, "Referer": settings.BASE_HEADERS_REFERER_URL}


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_person_data(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        person_id: str
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
        raise_for_status=True,
    )

    return response.get("json", {})[0]


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_movement_data(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        event_id: str
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
        raise_for_status=True,
    )
    return response.get("json", {})[0]


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_referral_data(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        event_id: str
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
        raise_for_status=True,
    )
    return response.get("json", {})[0]


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_disease_data(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        event_section_id: str
):
    url = settings.BASE_URL
    headers = HEADERS
    params = {"c": "EvnSection", "m": "loadEvnSectionEditForm"}
    data = {
        "EvnSection_id": event_section_id,
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
        raise_for_status=True,
    )
    return response.get("json", {}).get("fieldsData", {})[0]


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_referred_org_by_id(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        org_id: str
):
    url = settings.BASE_URL
    headers = HEADERS
    params = {"c": "Org", "m": "getOrgList"}
    data = {
        "Org_id": org_id,
    }

    response = await http_service.fetch(
        url=url,
        method="POST",
        cookies=cookies,
        headers=headers,
        params=params,
        data=data,
        raise_for_status=True,
    )

    return response.get("json", {})[0]


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_medical_service_data(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        event_id: str
):
    """
    Возвращает список услуг оказанных пациенту
    """
    url = settings.BASE_URL
    headers = HEADERS
    params = {"c": "EvnUsluga", "m": "loadEvnUslugaGrid"}
    data = {
        "pid": event_id,
        "parent": "EvnPS"
    }
    response = await http_service.fetch(
        url=url,
        method="POST",
        cookies=cookies,
        headers=headers,
        params=params,
        data=data,
        raise_for_status=True,
    )

    return response.get("json", {})
