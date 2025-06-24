from app.core import get_settings, HTTPXClient, logger
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


def _sanitize_medical_service_entry(entry: dict) -> dict[str, str]:
    """
     Извлекает ключевые данные из записи об услуге и возвращает
    их в виде структурированного словаря.
    """
    return {
        "code": entry.get("Usluga_Code", "").strip(),
        "name": entry.get("Usluga_Name", "").strip(),
    } if entry.get("Usluga_Code") else {}


@log_and_catch(debug=settings.DEBUG_HTTP)
async def fetch_medical_service_data(
        cookies: dict[str, str],
        http_service: HTTPXClient,
        event_id: str
) -> list[dict[str, str]]:
    """
    Находит и возвращает список операций среди всех услуг,
    оказанных пациенту в рамках госпитализации.
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

    services_list = response.get("json", [])
    operations_found = []

    if not isinstance(services_list, list):
        logger.warning(f"event_id: {event_id}, services_list не список: {type(services_list)}")
        return []

    for entry in services_list:
        if isinstance(entry, dict) and "EvnUslugaOper" in (entry.get("EvnClass_SysNick") or ""):
            sanitized_entry = _sanitize_medical_service_entry(entry)
            if sanitized_entry:
                logger.debug(f"Операция: {sanitized_entry['code']} — {sanitized_entry['name']}")
                operations_found.append(sanitized_entry)

    if operations_found:
        logger.debug(f"event_id: {event_id}, найдено операций: {len(operations_found)}")
    else:
        logger.warning(f"event_id: {event_id}, не найдено операции")

    return operations_found
