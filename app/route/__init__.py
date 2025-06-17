from fastapi import APIRouter

from .extension import router as extension_router
from .evmias import router as evmias_router

api_router = APIRouter()
api_router.include_router(extension_router)
# api_router.include_router(evmias_router)

__all__ = [
    "api_router",
]
