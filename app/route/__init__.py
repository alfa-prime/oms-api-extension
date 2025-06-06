from fastapi import APIRouter

from .gis_oms_extension import router as gis_oms_extension_router

api_router = APIRouter()
api_router.include_router(gis_oms_extension_router)

__all__ = [
    "api_router",
]
