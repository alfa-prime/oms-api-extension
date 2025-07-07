# Этап 1: Builder с созданием venv
FROM python:3.10 AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Создаем venv
RUN python -m venv /opt/venv
# Активируем его для последующих команд в этом слое
ENV PATH="/opt/venv/bin:$PATH"

# Копируем только requirements.txt для кэширования
WORKDIR /code
COPY requirements.txt .

# Устанавливаем зависимости в venv
RUN pip install --no-cache-dir -r requirements.txt

# Этап 2: Финальный образ
FROM python:3.10-slim

# Установка локалей (как и раньше)
RUN apt-get update && apt-get install -y --no-install-recommends locales \
 && sed -i '/ru_RU.UTF-8/s/^# //g' /etc/locale.gen \
 && locale-gen ru_RU.UTF-8 \
 && rm -rf /var/lib/apt/lists/*

ENV LANG=ru_RU.UTF-8 \
    LC_ALL=ru_RU.UTF-8 \
    PYTHONIOENCODING=utf-8 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Копируем venv из builder'а
COPY --from=builder /opt/venv /opt/venv

# Устанавливаем рабочую директорию
WORKDIR /code

# Копируем код приложения
COPY ./app /code/app

# Указываем PATH на venv, чтобы система знала, где искать uvicorn
ENV PATH="/opt/venv/bin:$PATH"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]