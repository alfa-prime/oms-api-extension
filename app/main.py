from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.core import (
    logger,
    init_httpx_client,
    shutdown_httpx_client,
    init_redis_client,
    shutdown_redis_client,
    HTTPXClient
)
from app.route import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Управление жизненным циклом приложения: инициализация и закрытие ресурсов.
    """
    # --- Startup Phase ---
    logger.info("Запуск приложения...")
    await init_httpx_client(app)
    await init_redis_client(app)
    app.state.http_client_service = HTTPXClient(client=app.state.http_client)
    logger.info("Инициализация завершена.")

    # --- Приложение работает ---
    yield

    # --- Shutdown Phase ---
    logger.info("Завершение работы приложения...")
    await shutdown_redis_client(app)  # Закрываем Redis перед HTTPX на всякий случай
    await shutdown_httpx_client(app)
    logger.info("Ресурсы освобождены.")


tags_metadata = [
    {"name": "Расширение", "description": "запросы из расширения к ЕВМИАС для ГИС ОМС"},
    {"name": "ЕВМИАС", "description": "Всяческие запросы к ЕВМИАС"},
]

app = FastAPI(
    openapi_tags=tags_metadata,
    title="АПИ для браузерного расширения ЕВМИАС-ОМС",
    description="АПИ для сбора данных из ЕВМИАС и заполнения формы ГИС ОМС.",
    lifespan=lifespan
)

# Подключаем маршруты API
app.include_router(api_router)
