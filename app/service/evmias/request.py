from app.core import get_settings, HTTPXClient
from app.mapper import disease_outcome_ids

settings = get_settings()
HEADERS = {"Origin": settings.BASE_HEADERS_ORIGIN_URL, "Referer": settings.BASE_HEADERS_REFERER_URL}


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
    )

    return response.get("json", {})[0]


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
    )
    return response.get("json", {})[0]


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
    )
    return response.get("json", {})[0]


async def fetch_disease_outcome_code(
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
    )

    disease_outcome_evmias_code = response.get("json", {}).get("fieldsData", {})[0].get("ResultDesease_id")
    disease_outcome_code = disease_outcome_ids[disease_outcome_evmias_code].get("code")

    return disease_outcome_code