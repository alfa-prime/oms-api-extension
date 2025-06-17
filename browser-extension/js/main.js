// browser-extension/js/main.js
import { initForm } from "./form.js";
import { debounce } from "./utils.js"; // debounce остается здесь
import { searchPatient } from "./searchLogic.js"; // Пока оставляем старый search.js
import { showUserError, showUserMessage } from "./ui.js"; // <--- ИЗМЕНЕНО: импорт из ui.js

let storedListMoData = null;

export function setupSearchHandler() {
  const debouncedSearch = debounce(searchPatient, 500);
  const searchButtonEl = document.getElementById("searchBtn"); // Можно получить ссылку здесь или в ui.js
  if (searchButtonEl) {
    searchButtonEl.addEventListener("click", debouncedSearch);
  }
  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        debouncedSearch();
      }
    });
  });
}

export function getStoredListMoData() {
  return storedListMoData;
}

window.addEventListener("DOMContentLoaded", () => {
  initForm();
  setupSearchHandler();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs.length) {
      showUserError("Не удалось получить доступ к активной вкладке."); // <--- ИЗМЕНЕНО
      return;
    }
    const tabId = tabs[0].id;

    if (!tabs[0].url || !tabs[0].url.startsWith("https://gisoms.ffoms.gov.ru")) {
      console.warn("Popup открыт не на странице ГИС ОМС. Список МО не будет запрошен.");
      showUserError("Расширение предназначено для gisoms.ffoms.gov.ru"); // <--- ИЗМЕНЕНО
      return;
    }

//    chrome.tabs.sendMessage(tabId, { action: "FETCH_LIST_MO" }, (response) => {
//      if (chrome.runtime.lastError) {
//          console.error("Ошибка sendMessage для FETCH_LIST_MO:", chrome.runtime.lastError.message);
//          showUserError("Ошибка связи со страницей: " + chrome.runtime.lastError.message); // <--- ИЗМЕНЕНО
//          return;
//      }
//      if (!response) {
//        showUserError("Нет ответа от content.js для списка МО."); // <--- ИЗМЕНЕНО
//        return;
//      }
//      if (!response.success) {
//        showUserError(`Не удалось получить список МО: ${response.status || "неизвестная ошибка"}`); // <--- ИЗМЕНЕНО
//        return;
//      }
//
//      console.log("✅ МО получены (через content.js):", response.data);
//      if (response.data && response.data.data && Array.isArray(response.data.data)) {
//          storedListMoData = response.data.data;
//          showUserMessage("Справочник МО успешно загружен (" + storedListMoData.length + " записей)", "info"); // <--- ИЗМЕНЕНО
//      } else {
//          storedListMoData = null;
//          showUserError("Справочник МО: неверный формат данных."); // <--- ИЗМЕНЕНО
//          console.error("Ожидаемая структура response.data.data не найдена:", response.data);
//      }
//    });
  });
});