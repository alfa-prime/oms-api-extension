from fastapi import APIRouter

from app.core import get_settings, logger
from .extension import router as extension_router

settings = get_settings()

api_router = APIRouter()
api_router.include_router(extension_router)

if settings.DEBUG_ROUTE:
    from .evmias import router as evmias_router

    api_router.include_router(evmias_router)
    logger.warning("Отладочные роуты '/evmias' активны. НЕ ИСПОЛЬЗОВАТЬ В ПРОДАКШЕНЕ!")

__all__ = [
    "api_router",
]
