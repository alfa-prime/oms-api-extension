from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Класс конфигурации приложения.
    Загружает настройки из переменных окружения (файла .env) и валидирует их типы.
    """
    # === EVMIAS Connection ===
    BASE_URL: str
    BASE_HEADERS_ORIGIN_URL: str
    BASE_HEADERS_REFERER_URL: str

    # === EVMIAS Authentication ===
    EVMIAS_LOGIN: str
    EVMIAS_PASSWORD: str
    EVMIAS_SECRET: str
    EVMIAS_PERMUTATION: str

    # === Application Logic Parameters ===
    MO_REGISTRY_NUMBER: str
    LPU_ID: str
    KSG_YEAR: str
    SEARCH_PERIOD_START_DATE: str

    # === Redis Configuration ===
    REDIS_HOST: str
    REDIS_PORT: int  # Порт - это число
    REDIS_DB: int  # Номер базы - это число
    REDIS_COOKIES_KEY: str
    REDIS_COOKIES_TTL: int  # TTL - это число (секунды)

    # === Настройки безопасности и отладки ===
    CORS_ALLOW_REGEX: str = r"^chrome-extension://[a-z]{32}$"
    LOGS_LEVEL: str
    DEBUG_HTTP: bool = False
    DEBUG_ROUTE: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",  # Явно указываем путь к .env в корне проекта
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """
    Получает объект конфигурации с кэшированием.
    Использует `lru_cache()`, чтобы загружать настройки только **один раз** при запуске приложения.
    Это оптимизирует работу FastAPI и уменьшает нагрузку на систему.
    """
    return Settings()
