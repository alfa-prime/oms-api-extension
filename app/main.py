from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    # {"name": "ЕВМИАС", "description": "Всяческие запросы к ЕВМИАС"},
]

app = FastAPI(
    openapi_tags=tags_metadata,
    title="АПИ для браузерного расширения ЕВМИАС-ОМС",
    description="АПИ для сбора данных из ЕВМИАС и заполнения формы ГИС ОМС.",
    lifespan=lifespan
)

# Для локальной разработки, чтобы не мучаться с ID, можно разрешить все источники
# ВАЖНО: В продакшене так делать НЕЛЬЗЯ из соображений безопасности.
# origins = ["*"]

origins = ["*"]

# origins = [
#     # Источник вашего расширения. ID 'kdoomom...' может меняться при переустановке.
#     # Для разработки можно использовать wildcard или конкретный ID.
#     "chrome-extension://kdoomomlibpmmcbaeaonghaelfgdbh",
#     # Для продакшена, когда у расширения будет постоянный ID в магазине
#     # "chrome-extension://ПОСТОЯННЫЙ_ID_ВАШЕГО_РАСШИРЕНИЯ",
#     # Если вы иногда тестируете с локального файла, можно добавить:
#     "null"
# ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Разрешить все методы (GET, POST, и т.д.)
    allow_headers=["*"], # Разрешить все заголовки
)



# Подключаем маршруты API
app.include_router(api_router)
