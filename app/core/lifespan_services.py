import httpx
import redis.asyncio as redis
from fastapi import FastAPI

from app.core import logger, get_settings

settings = get_settings()


async def init_httpx_client(app: FastAPI):
    """Инициализирует и сохраняет HTTPX клиент в app.state. При ошибке приложение падает и не стартует."""
    try:
        base_client = httpx.AsyncClient(
            timeout=30.0,
            verify=False,  # Помним про TODO: убрать verify=False
        )
        app.state.http_client = base_client
        logger.info("Базовый HTTPX клиент инициализирован и сохранен в app.state")
    except Exception as e:
        logger.critical(f"КРИТИЧНО: Не удалось инициализировать HTTPX клиент: {e}", exc_info=True)
        raise RuntimeError(f"Failed to initialize HTTPX client: {e}")


async def shutdown_httpx_client(app: FastAPI):
    """Закрывает HTTPX клиент."""
    if hasattr(app.state, 'http_client') and app.state.http_client:
        try:
            await app.state.http_client.aclose()
            logger.info("Базовый HTTPX клиент закрыт")
        except Exception as e:
            logger.error(f"Ошибка при закрытии HTTPX клиента: {e}", exc_info=True)


async def init_redis_client(app: FastAPI):
    """Инициализирует и сохраняет Redis клиент в app.state. При ошибке приложение падает и не стартует."""
    try:
        redis_pool = redis.ConnectionPool.from_url(
            url=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}",
            decode_responses=False,
            max_connections=10
        )
        redis_client = redis.Redis(connection_pool=redis_pool)
        await redis_client.ping()  # Проверка соединения
        app.state.redis_client = redis_client
        logger.info(
            f"Redis клиент подключен к {settings.REDIS_HOST}:{settings.REDIS_PORT} (DB {settings.REDIS_DB}) "
            f"и сохранен в app.state"
        )
    except Exception as e:
        logger.critical(f"КРИТИЧНО: Не удалось подключиться к Redis: {e}", exc_info=True)
        raise RuntimeError(f"Failed to connect to Redis: {e}")


async def shutdown_redis_client(app: FastAPI):
    """Закрывает Redis клиент."""
    if hasattr(app.state, 'redis_client') and app.state.redis_client:
        try:
            await app.state.redis_client.close()
            logger.info("Redis клиент закрыт")
        except Exception as e:
            logger.error(f"Ошибка при закрытии Redis клиента: {e}", exc_info=True)
