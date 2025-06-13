from datetime import datetime, timedelta

from app.core import logger
from app.mapper import bed_profiles


async def get_medical_care_condition(lpu_section_name: str) -> str:
    """
    Определяет код условия оказания медицинской помощи, в зависимости от отделения
    """
    inpatient_care = "1"
    day_hospital_care = "2"
    logger.info(f"Определяем условия оказания медицинской помощи. Отделение: {lpu_section_name}")
    return day_hospital_care if lpu_section_name.startswith("ДС") else inpatient_care


async def get_direction_date(admission_date: str) -> str | None:
    """
    Вычисляет дату направления на госпитализацию, в зависимости от даты госпитализации.
    Это должны быть пн, ср или пт. до даты госпитализации.
    """
    try:
        admission_date = datetime.strptime(admission_date, "%d.%m.%Y")
    except ValueError:
        logger.warning(f"Неверный формат даты: {admission_date}")
        return None
    # Разрешённые дни недели: понедельник (0), среда (2), пятница (4)
    allowed_days = [0, 2, 4]
    # Начинаем с дня до поступления
    for i in range(1, 8):  # максимум неделя в прошлое
        candidate = admission_date - timedelta(days=i)
        if candidate.weekday() in allowed_days:
            return candidate.strftime("%d.%m.%Y")
    return None


async def get_medical_care_form(data) -> str | None:
    """
    Определяет код формы оказания медицинской помощи, в зависимости от типа госпитализации
    """
    scheduled_hospitalization_code = "3"
    emergency_hospitalization_code = "1"

    raw_medical_care_form_id = data.get('PrehospDirect_id')
    if raw_medical_care_form_id is None:
        logger.warning("Не найден PrehospDirect_id в данных")
        return None

    medical_care_form_id = str(raw_medical_care_form_id)
    logger.info(f"Определяем код формы медицинской помощи. evmias_id: {medical_care_form_id}")

    match medical_care_form_id:
        case "2":
            return scheduled_hospitalization_code
        case "1" | "3":
            return emergency_hospitalization_code
        case _:
            return None


async def get_bed_profile_code(bed_profile_name: str) -> str | None:
    """
    Возвращает код профиля койки по её названию.
    """
    bed_profile_id = bed_profiles.get(bed_profile_name)
    if not bed_profile_id:
        logger.warning(f"Не найден код профиля койки для: {bed_profile_name}")
        return None
    logger.info(f"Определяем код профиля койки: {bed_profile_name}, код: {bed_profile_id}")
    return str(bed_profile_id)
