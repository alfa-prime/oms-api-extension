from datetime import datetime
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field, constr, model_validator


class ExtensionStartedData(BaseModel):
    """Модель для стартовых данных"""
    last_name: str = Field(..., description="Фамилия пациента", examples=["Бобов"])
    first_name: Optional[str] = Field(None, description="Имя пациента", examples=["Игорь"])
    middle_name: Optional[str] = Field(None, description="Отчество пациента", examples=["Константинович"])
    birthday: Optional[constr(pattern=r"\d{2}\.\d{2}\.\d{4}")] = Field(
        None,
        description="Дата рождения в формате DD.MM.YYYY",
        examples=["04.02.1961"]
    )
    start_date: Optional[str] = Field(None, description="Дата начала периода в формате YYYY-MM-DD", examples=[""])
    end_date: Optional[str] = Field(None, description="Дата окончания периода в формате YYYY-MM-DD", examples=[""])
    dis_date_range: Optional[str] = Field(None, description="Диапазон дат госпитализации", examples=[""])

    @model_validator(mode="before")
    @classmethod
    def validate_and_format_date_range(cls, data: dict) -> dict:
        start_date = data.get("start_date")
        end_date = data.get("end_date")

        if start_date and end_date:
            try:
                start = datetime.strptime(start_date, "%Y-%m-%d")
                end = datetime.strptime(end_date, "%Y-%m-%d")

                if start > end:
                    raise ValueError("Дата начала не может быть позже даты окончания")

                data["dis_date_range"] = f"{start.strftime('%d.%m.%Y')} - {end.strftime('%d.%m.%Y')}"
            except ValueError as e:
                raise ValueError(f"Ошибка в диапазоне дат: {e}")

        return data


class EnrichmentRequestData(BaseModel):
    """Модель данных для получения данных от фронтенда"""
    started_data: Dict[str, Any] = Field(..., description="Оригинальные данные о событии/пациенте из ЕВМИАС")
