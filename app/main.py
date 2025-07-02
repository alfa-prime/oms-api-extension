from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import (
    get_settings,
    logger,
    init_httpx_client,
    shutdown_httpx_client,
    init_redis_client,
    shutdown_redis_client,
)
from app.route import api_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Управление жизненным циклом приложения: инициализация и закрытие ресурсов.
    """
    # --- Startup Phase ---
    logger.info("Запуск приложения...")
    await init_httpx_client(app)
    await init_redis_client(app)
    logger.info("Инициализация завершена.")

    # --- Приложение работает ---
    yield

    # --- Shutdown Phase ---
    logger.info("Завершение работы приложения...")
    await shutdown_redis_client(app)
    await shutdown_httpx_client(app)
    logger.info("Ресурсы освобождены.")


tags_metadata = [
    {"name": "Расширение", "description": "запросы из расширения к ЕВМИАС для ГИС ОМС"},
    {"name": "ЕВМИАС", "description": "Тестовые запросы к ЕВМИАС"},
]

app = FastAPI(
    openapi_tags=tags_metadata,
    title="АПИ для браузерного расширения ЕВМИАС-ОМС",
    description="АПИ для сбора данных из ЕВМИАС и заполнения формы ГИС ОМС.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,  # noqa
    # allow_origin_regex=settings.CORS_ALLOW_REGEX,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=["*"],  # Разрешить все методы (GET, POST, и т.д.)
    allow_headers=["*"],  # Разрешить все заголовки
)

app.include_router(api_router)
