/**
 * main.js
 * Точка входа. Подключает всё вместе:
 *  - инициализация формы
 *  - навешивание обработчика поиска
 *  - получение и хранение списка МО
 */

import { initForm } from "./form.js";
import { debounce, showError, showMessage } from "./utils.js";
import { searchPatient } from "./search.js";

// Переменная для хранения списка МО
let storedListMoData = null;

export function setupSearchHandler() {
  // Debounce-версия функции поиска (чтобы при множественных Enter не спамить запросами)
  const debouncedSearch = debounce(searchPatient, 500);
  // Навешиваем на кнопку
  document
    .getElementById("searchBtn")
    .addEventListener("click", debouncedSearch);
  // Навешиваем на Enter в любых input
  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        debouncedSearch();
      }
    });
  });
}

// Getter для получения списка МО
export function getStoredListMoData() {
  return storedListMoData;
}

// Запускаем всё при загрузке DOM
window.addEventListener("DOMContentLoaded", () => {
  initForm();
  setupSearchHandler();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs.length) {
      showError("Не удалось получить доступ к активной вкладке.");
      return;
    }
    const tabId = tabs[0].id;

    // Убедимся, что мы на нужной странице перед отправкой сообщения
    if (
      !tabs[0].url ||
      !tabs[0].url.startsWith("https://gisoms.ffoms.gov.ru")
    ) {
      console.warn(
        "Popup открыт не на странице ГИС ОМС. Список МО не будет запрошен.",
      );
      showError("Расширение предназначено для gisoms.ffoms.gov.ru");
      return;
    }

    chrome.tabs.sendMessage(tabId, { action: "FETCH_LIST_MO" }, (response) => {
      // Этот callback сработает, когда content.js вызовет sendResponse(...)
      if (!response) {
        showError("Нет ответа от content.js");
        return;
      }

      if (!response.success && response.status === 404) {
        showError("Список МО временно недоступен (404). Попробуйте позже.");
        return;
      } else if (!response.success) {
        showError("Не удалось получить список МО: " + response.status);
        return;
      }

      console.log("✅ МО получены (через content.js):", response.data);
      storedListMoData = response.data;
      showMessage("Справочник МО успешно загружен", "info");
    });
  });
});
