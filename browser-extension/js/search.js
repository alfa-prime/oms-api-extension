/**
 * search.js
 * Логика поиска пациента:
 *  - собирает данные формы
 *  - валидация: startDate <= endDate, обязательна фамилия
 *  - запрос к API (POST на /search)
 *  - отрисовка результатов
 *  - навешивание обработчика кнопки «Выбрать» (вставка через chrome.scripting.executeScript)
 * Оригинальный код searchPatient без изменений.
 */

import { showMessage, showError } from "./utils.js";
import { getStoredListMoData } from "./main.js";
// import { insertData } from "./insert.js";

const API_SEARCH_URL = "http://0.0.0.0:8000/extension/search";
const API_ENRICH_URL = "http://0.0.0.0:8000/extension/enrich-data";

export async function searchPatient() {
  const searchBtn = document.getElementById("searchBtn");
  const messageEl = document.getElementById("message");
  const loadingEl = document.getElementById("loading");
  const resultsList = document.getElementById("results");

  // Считываем значения из формы
  const last_name = document.getElementById("lastname").value.trim();
  //  const first_name = document.getElementById("firstname").value.trim();
  //  const middle_name = document.getElementById("middlename").value.trim();
  //  const birthday = document.getElementById("birthday").value.trim();
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  // Очистка результатов и сообщений
  messageEl.style.display = "none";
  messageEl.textContent = "";
  resultsList.innerHTML = "";
  loadingEl.style.display = "block";
  searchBtn.disabled = true;
  searchBtn.textContent = "Поиск...";

  // Простая валидация
  if (startDate > endDate) {
    showError("Дата начала не может быть позже даты окончания");
    return;
  }

  if (!last_name) {
    showError("Фамилия обязательна");
    return;
  }

  // Формируем тело запроса
  const searchPayload = { last_name, start_date: startDate, end_date: endDate };
  //  if (first_name) payload.first_name = first_name;
  //  if (middle_name) payload.middle_name = middle_name;
  //  if (birthday) payload.birthday = birthday;

  try {
    // Запрос к API
    const searchResponse = await fetch(API_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchPayload),
    });

    if (!searchResponse.ok) {
      const errorData = await searchResponse
        .json()
        .catch(() => ({ detail: "Ошибка поиска" }));
      throw new Error(
        errorData.detail || `Ошибка ${searchResponse.status} при поиске`,
      );
    }

    const results = await searchResponse.json();

    if (!Array.isArray(results))
      throw new Error("Результаты поиска не являются массивом");

    if (results.length === 0) {
      showMessage("Записи не найдены", "info");
      return;
    }

    resultsList.innerHTML = ""; // Очищаем перед добавлением новых

    results.forEach((item) => {
      // Убрал 'index', так как он не используется для data-index
      const person =
        `${item.Person_Surname || ""} ${item.Person_Firname || ""} ${item.Person_Secname || ""} (${item.Person_Birthday || "N/A"})`.trim();
      const card = item.EvnPS_NumCard || "N/A";
      const hospDate = item.EvnPS_setDate || "N/A";

      const li = document.createElement("li");
      li.innerHTML = `
                <div><strong>${person}</strong></div>
                <div><br></div>
                <div>Номер карты: ${card}</div>
                <div>Дата госпитализации: ${hospDate}</div>
                <div><br></div>
                <button class="select-btn">Выбрать</button>
            `; // Убрал data-index, если он не нужен для другой логики
      resultsList.appendChild(li);

      // Кнопка "Выбрать" ТЕПЕРЬ вызывает запрос на обогащение
      li.querySelector("button").addEventListener("click", async () => {
        // Показываем прелоадер/блокируем UI на время обогащения
        loadingEl.style.display = "block";
        // Можно задизейблить все кнопки "Выбрать" или только эту
        li.querySelector("button").disabled = true;
        li.querySelector("button").textContent = "Обработка...";
        messageEl.style.display = "none";

        try {
          const listMoDataFromStore = getStoredListMoData(); // Получаем актуальный список МО (массив)
          const enrichmentPayload = {
            started_data: item, // Передаем весь объект item из результатов поиска
            medical_orgs_list: listMoDataFromStore, // Это должен быть массив объектов МО или null
          };

          const enrichResponse = await fetch(API_ENRICH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(enrichmentPayload),
          });

          if (!enrichResponse.ok) {
            let errorPayloadDetail =
              "Не удалось получить детали ошибки от сервера.";
            try {
              const errorDataFromServer = await enrichResponse.json();
              if (errorDataFromServer && errorDataFromServer.detail) {
                if (typeof errorDataFromServer.detail === "string") {
                  errorPayloadDetail = errorDataFromServer.detail;
                } else if (Array.isArray(errorDataFromServer.detail)) {
                  // Если detail - массив, пробуем его как-то осмысленно соединить
                  errorPayloadDetail = errorDataFromServer.detail
                    .map((d) =>
                      typeof d === "object" && d !== null && d.message
                        ? d.message
                        : JSON.stringify(d),
                    )
                    .join("; ");
                } else if (
                  typeof errorDataFromServer.detail === "object" &&
                  errorDataFromServer.detail !== null
                ) {
                  errorPayloadDetail = JSON.stringify(
                    errorDataFromServer.detail,
                  );
                }
              }
            } catch (e) {
              console.warn(
                "Не удалось распарсить JSON из ответа об ошибке обогащения:",
                e,
              );
            }
            throw new Error(
              errorPayloadDetail ||
                `Ошибка ${enrichResponse.status} при обогащении данных`,
            );
          }

          const enrichedDataForForm = await enrichResponse.json(); // Это будет словарь {selector: value, ...} от бэкенда

          // Теперь вставляем обогащенные данные
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs.length) {
              showError("Нет активной вкладки для вставки данных.");
              // Возвращаем кнопку в исходное состояние, если вкладки нет
              li.querySelector("button").disabled = false;
              li.querySelector("button").textContent = "Выбрать";
              loadingEl.style.display = "none";
              return;
            }
            chrome.scripting.executeScript(
              {
                target: { tabId: tabs[0].id },
                // Функция func теперь принимает объект, где ключи - селекторы, значения - данные для вставки
                func: (dataMapToInsert) => {
                  console.log("Вставка обогащенных данных", dataMapToInsert);
                  const iframe = document.querySelector(
                    "iframe[name='mainFrame'], iframe#mainFrame, iframe",
                  ); // Более точный селектор для iframe
                  if (!iframe) {
                    console.warn(
                      "iframe не найден. Попытка поиска по другому селектору...",
                    );
                    // alert("iframe не найден на странице ГИС ОМС."); // Сообщение для пользователя
                    // Можно попробовать альтернативные селекторы, если стандартный не сработал
                    // const alternativeIframe = document.querySelector("#anotherPossibleIframeId");
                    // if (!alternativeIframe) {
                    //    console.error("Альтернативный iframe также не найден.");
                    //    return {success: false, error: "iframe не найден"};
                    // }
                    // iframe = alternativeIframe;
                    return { success: false, error: "iframe не найден" }; // Возвращаем ошибку, чтобы обработать в callback
                  }
                  const doc = iframe.contentWindow.document;

                  let allElementsFound = true;
                  for (const [selector, valueToInsert] of Object.entries(
                    dataMapToInsert,
                  )) {
                    const el = doc.querySelector(selector);
                    if (el) {
                      el.value = valueToInsert; // Бэкенд должен предоставить корректное значение
                      el.classList.remove("x-form-invalid-field");
                      el.setAttribute("aria-invalid", "false");
                      el.setAttribute("data-errorqtip", "");
                      // Дополнительно можно сгенерировать события change или input, если это нужно для логики страницы
                      // el.dispatchEvent(new Event('input', { bubbles: true }));
                      // el.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                      console.warn(
                        "Не найден элемент для селектора:",
                        selector,
                      );
                      allElementsFound = false; // Отмечаем, что не все элементы найдены
                    }
                  }
                  return { success: true, allElementsFound: allElementsFound }; // Возвращаем результат для callback
                },
                args: [enrichedDataForForm], // Передаем обогащенные данные
              },
              (injectionResults) => {
                // Обработка результата executeScript
                if (chrome.runtime.lastError) {
                  console.error(
                    "Ошибка executeScript:",
                    chrome.runtime.lastError.message,
                  );
                  showError(
                    "Ошибка при вставке данных: " +
                      chrome.runtime.lastError.message,
                  );
                } else if (
                  injectionResults &&
                  injectionResults[0] &&
                  injectionResults[0].result
                ) {
                  const result = injectionResults[0].result;
                  if (result.success) {
                    console.log(
                      "Данные успешно вставлены. Все ли элементы найдены:",
                      result.allElementsFound,
                    );
                    if (!result.allElementsFound) {
                      showMessage(
                        "Данные частично вставлены (не все поля найдены). Проверьте форму.",
                        "info",
                      );
                      // Не закрываем окно, чтобы пользователь мог видеть предупреждения в консоли popup
                    } else {
                      window.close(); // Закрываем окно расширения только при полном успехе
                    }
                  } else {
                    showError(
                      "Ошибка при вставке данных на странице: " +
                        (result.error || "Неизвестная ошибка"),
                    );
                  }
                } else {
                  // Этого не должно происходить, если func возвращает объект
                  showError("Не удалось получить результат операции вставки.");
                }
                // Возвращаем кнопку в исходное состояние в любом случае, кроме успешного закрытия
                if (
                  !injectionResults ||
                  !injectionResults[0] ||
                  !injectionResults[0].result ||
                  !injectionResults[0].result.success ||
                  !injectionResults[0].result.allElementsFound
                ) {
                  li.querySelector("button").disabled = false;
                  li.querySelector("button").textContent = "Выбрать";
                  loadingEl.style.display = "none";
                }
              },
            );
          });
        } catch (err) {
          console.error("Ошибка при обогащении или вставке:", err);
          showError(err.message);
          li.querySelector("button").disabled = false; // Возвращаем кнопку в исходное состояние при ошибке
          li.querySelector("button").textContent = "Выбрать";
        } finally {
          // Убираем общий прелоадер только если нет других активных операций
          // или если это была последняя операция.
          // Для простоты, если ошибка не привела к закрытию, прячем прелоадер.
          if (loadingEl.style.display === "block" && !window.closed) {
            // Проверяем, не закрыто ли окно
            // loadingEl.style.display = "none"; // Глобальный лоадер лучше убирать в конце всей операции поиска
          }
        }
      });
    });
  } catch (err) {
    console.error("Ошибка API поиска:", err);
    showError(err.message);
  } finally {
    loadingEl.style.display = "none"; // Скрываем прелоадер после завершения первоначального поиска
    searchBtn.disabled = false;
    searchBtn.textContent = "Искать";
  }
}
