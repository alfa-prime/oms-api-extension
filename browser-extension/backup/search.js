// browser-extension/js/search.js
// Заменяем импорты и прямое управление DOM на функции из ui.js

// import { showMessage, showError } from "./utils.js"; // Старый импорт
import {
    showUserMessage,
    showUserError,
    showLoading,
    hideLoading,
    setSearchButtonState,
    setSelectButtonState, // Добавили для кнопки "Выбрать"
    clearResultsList,
    clearUserMessages
} from "./ui.js"; // Новый импорт
import { getStoredListMoData } from "./main.js";

const API_SEARCH_URL = "http://0.0.0.0:8000/extension/search";
const API_ENRICH_URL = "http://0.0.0.0:8000/extension/enrich-data";

// resultsListEl теперь получается внутри ui.js, но для добавления li он нужен здесь
const resultsList = document.getElementById("results");

export async function searchPatient() {
  // const searchBtn = document.getElementById("searchBtn"); // Управляется через ui.js
  // const messageEl = document.getElementById("message"); // Управляется через ui.js
  // const loadingEl = document.getElementById("loading"); // Управляется через ui.js
  // const resultsList = document.getElementById("results"); // Получаем выше

  const lastName = document.getElementById("lastname").value.trim();
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  clearUserMessages();
  clearResultsList();
  showLoading();
  setSearchButtonState(false, "Поиск...");

  if (startDate > endDate) {
    showUserError("Дата начала не может быть позже даты окончания");
    // setSearchButtonState(true, "Искать"); // setSearchButtonState вызывается в showUserError
    // hideLoading(); // hideLoading вызывается в showUserError (через showUserMessage)
    return;
  }
  if (!lastName) {
    showUserError("Фамилия обязательна");
    return;
  }

  const searchPayload = { last_name: lastName, start_date: startDate, end_date: endDate };

  try {
    const searchResponse = await fetch(API_SEARCH_URL, { /* ... */ });

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json().catch(() => ({ detail: "Ошибка поиска" }));
      throw new Error(errorData.detail || `Ошибка ${searchResponse.status} при поиске`);
    }

    const results = await searchResponse.json();

    if (!Array.isArray(results)) throw new Error("Результаты поиска не являются массивом");

    if (results.length === 0) {
      showUserMessage("Записи не найдены", "info");
      // setSearchButtonState(true, "Искать"); // Вызывается в showUserMessage если type не error
      // hideLoading(); // Вызывается в showUserMessage
      return;
    }

    // Если дошли сюда и есть результаты, основной поиск успешен
    hideLoading(); // Скрываем лоадер, если он еще виден
    setSearchButtonState(true, "Искать"); // Восстанавливаем кнопку поиска

    // clearResultsList(); // Уже было вызвано в начале
    results.forEach((item) => {
      const person = `${item.Person_Surname || ""} ${item.Person_Firname || ""} ${item.Person_Secname || ""} (${item.Person_Birthday || "N/A"})`.trim();
      const card = item.EvnPS_NumCard || "N/A";
      const hospDate = item.EvnPS_setDate || "N/A";

      const li = document.createElement("li");
      li.innerHTML = `...`; // как и было
      resultsList.appendChild(li); // resultsList определен в этом файле

      const selectButton = li.querySelector("button");
      selectButton.addEventListener("click", async () => {
        showLoading(); // Показываем индикатор для операции "Выбрать"
        setSelectButtonState(selectButton, false, "Обработка...");
        clearUserMessages();

        try {
          const listMoDataFromStore = getStoredListMoData();
          const enrichmentPayload = {
            original_evmias_data: item,
            list_mo_data: listMoDataFromStore,
          };

          const enrichResponse = await fetch(API_ENRICH_URL, { /* ... */ });

          if (!enrichResponse.ok) {
            // ... логика извлечения errorPayloadDetail как и была ...
            let errorPayloadDetail = "..."; // Ваша логика здесь
            throw new Error(errorPayloadDetail || `Ошибка ${enrichResponse.status} при обогащении данных`);
          }

          const enrichedDataForForm = await enrichResponse.json();

          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs.length) {
              showUserError("Нет активной вкладки для вставки данных.");
              setSelectButtonState(selectButton, true, "Выбрать");
              // hideLoading(); // Вызывается в showUserError
              return;
            }
            chrome.scripting.executeScript(
              { /* ... */ },
              (injectionResults) => {
                hideLoading(); // Скрываем лоадер после завершения executeScript
                if (chrome.runtime.lastError) {
                  showUserError("Ошибка при вставке данных: " + chrome.runtime.lastError.message);
                } else if (injectionResults && injectionResults[0] && injectionResults[0].result) {
                  const result = injectionResults[0].result;
                  if (result.success) {
                    if (!result.allElementsFound) {
                      showUserMessage("Данные частично вставлены (не все поля найдены). Проверьте форму.", "info");
                    } else {
                      window.close();
                    }
                  } else {
                    showUserError("Ошибка при вставке данных на странице: " + (result.error || "Неизвестная ошибка"));
                  }
                } else {
                  showUserError("Не удалось получить результат операции вставки.");
                }

                if (!window.closed) { // Если окно не закрыто
                    setSelectButtonState(selectButton, true, "Выбрать");
                }
              }
            );
          });
        } catch (err) {
          showUserError(err.message);
          setSelectButtonState(selectButton, true, "Выбрать");
          // hideLoading(); // Вызывается в showUserError
        }
        // Блок finally в оригинальном коде был закомментирован, так что пока его нет
      });
    });
  } catch (err) { // Ошибка от fetch API_SEARCH_URL или парсинга его JSON
    showUserError(err.message);
    // setSearchButtonState(true, "Искать"); // Вызывается в showUserError
    // hideLoading(); // Вызывается в showUserError
  } finally {
    // Глобальный finally из search.js оставляем, но он может быть избыточен
    // если hideLoading и setSearchButtonState уже вызываются во всех ветках try/catch
    // или в showUserMessage/showUserError
    // Однако, если какая-то ветка не вызывает showError/showMessage, этот finally полезен
    const finalLoadingEl = document.getElementById("loading"); // Получаем снова, т.к. область видимости
    if(finalLoadingEl && finalLoadingEl.style.display !== "none") hideLoading();

    const finalSearchBtn = document.getElementById("searchBtn");
    if(finalSearchBtn && finalSearchBtn.disabled) setSearchButtonState(true, "Искать");
  }
}