from datetime import datetime, timedelta

from app.core import logger
from app.mapper import bed_profiles


async def get_medical_care_condition(lpu_section_name: str) -> str:
    """
    Определяет код условия оказания медицинской помощи, в зависимости от отделения
    1 - стационар, 2 - дневной стационар
    """
    logger.info(f"Определяем условия оказания медицинской помощи. Отделение: {lpu_section_name}")
    return "2" if lpu_section_name.startswith("ДС") else "1"


async def get_direction_date(admission_date: str) -> str:
    """
    Вычисляет дату направления на госпитализацию, в зависимости от даты госпитализации.
    Это должны быть пн, ср или пт. до даты госпитализации.
    """
    admission_date = datetime.strptime(admission_date, "%d.%m.%Y")
    # Разрешённые дни недели: понедельник (0), среда (2), пятница (4)
    allowed_days = [0, 2, 4]
    # Начинаем с дня до поступления
    for i in range(1, 8):  # максимум неделя в прошлое
        candidate = admission_date - timedelta(days=i)
        if candidate.weekday() in allowed_days:
            return candidate.strftime("%d.%m.%Y")

    return "Не найден подходящий день"


async def get_medical_care_form(data) -> str:
    raw_medical_care_form_id = data.get('PrehospDirect_id')
    medical_care_form_id = str(raw_medical_care_form_id)
    if medical_care_form_id == "2":
        medical_care_form_id = "3"
    return medical_care_form_id



async def get_bed_profile_code(bed_profile_name: str) -> str:
    return bed_profiles[bed_profile_name]

