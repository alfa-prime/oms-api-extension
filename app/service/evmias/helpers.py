"""
Модуль вспомогательных функций для модуля service/evmias/request.py
включает в себя функции очистки данных, ...
"""
from typing import List, Dict, Any


def sanitize_medical_service_entry(entry: Dict) -> Dict[str, str]:
    """
    Извлекает ключевые данные из записи об услуге и возвращает
    их в виде структурированного словаря.
    """
    return {
        "code": entry.get("Usluga_Code", "").strip(),
        "name": entry.get("Usluga_Name", "").strip(),
    } if entry.get("Usluga_Code") else {}


def filter_operations_from_services(services: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    Фильтрует список услуг, оставляя только операции.
    """
    if not isinstance(services, list):
        return []

    operations = []
    for entry in services:
        # EvnUslugaOper — системный идентификатор услуги, которая является операцией
        service_type = entry.get("EvnClass_SysNick", "")
        if isinstance(entry, dict) and "EvnUslugaOper" in service_type:
            sanitized_entry = sanitize_medical_service_entry(entry)
            if sanitized_entry:
                operations.append(sanitized_entry)

    return operations


def sanitize_additional_diagnosis_entry(entry: dict) -> dict[str, str]:
    """
    Извлекает и очищает ключевые данные из записи о дополнительном диагнозе.
    Возвращает словарь или None, если код диагноза отсутствует.
    """
    return {
        "code": entry.get("Diag_Code", "").strip(),
        "name": entry.get("Diag_Name", "").strip(),
    } if entry.get("Diag_Code") else {}


def process_diagnosis_list(diagnosis_list: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """
    Обрабатывает "сырой" список диагнозов, очищая каждый элемент.
    Использует list comprehension для краткости и эффективности.
    """
    if not isinstance(diagnosis_list, list):
        return []

    # Это списковое включение делает то же, что и ваш цикл for, но в одну строку.
    # Оно проходит по каждому 'entry', вызывает 'sanitize...', и если результат не None,
    # добавляет его в новый список.
    return [
        sanitized
        for entry in diagnosis_list
        if (sanitized := sanitize_additional_diagnosis_entry(entry))
    ]
