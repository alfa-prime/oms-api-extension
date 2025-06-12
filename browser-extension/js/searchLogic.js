// browser-extension/js/searchLogic.js

import * as ui from "./ui.js";
import * as api from "./apiService.js"; // <--- Используем обновленный apiService
import { injectData } from "./pageInjector.js";
import { getStoredListMoData } from "./main.js";

const resultsList = document.getElementById("results");

export async function searchPatient() {
    const lastName = document.getElementById("lastname").value.trim();
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    ui.clearUserMessages();
    ui.clearResultsList();
    ui.showLoading();
    ui.setSearchButtonState(false, "Поиск...");

    if (startDate > endDate) {
        ui.showUserError("Дата начала не может быть позже даты окончания");
        return;
    }
    if (!lastName) {
        ui.showUserError("Фамилия обязательна");
        return;
    }

    const searchPayload = { last_name: lastName, start_date: startDate, end_date: endDate };

    try {
        // Используем функцию из apiService, которая уже вернет данные или выбросит ошибку
        const results = await api.fetchSearchResults(searchPayload);
        // console.log("[SearchLogic] Результаты получены:", results); // Лог уже есть в apiService

        // Проверка на массив и пустоту остается здесь, так как это логика представления
        if (!Array.isArray(results)) {
            // Эта ошибка не должна возникать, если API всегда возвращает массив или ошибку
            console.error("[SearchLogic] API поиска вернул не массив:", results);
            throw new Error("Получен некорректный формат данных от сервера поиска.");
        }

        if (results.length === 0) {
            ui.showUserMessage("Записи не найдены", "info");
            // ui.setSearchButtonState(true, "Искать"); // Вызывается в ui.showUserMessage если type не error
            // ui.hideLoading(); // Вызывается в ui.showUserMessage
            return;
        }

        ui.hideLoading();
        ui.setSearchButtonState(true, "Искать");

        // ui.clearResultsList(); // Уже было
        results.forEach((item) => {
            const person = `${item.Person_Surname || ""} ${item.Person_Firname || ""} ${item.Person_Secname || ""} (${item.Person_Birthday || "N/A"})`.trim();
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
            `;
            resultsList.appendChild(li);

            const selectButton = li.querySelector("button");
            selectButton.addEventListener("click", async () => {
                ui.showLoading();
                ui.setSelectButtonState(selectButton, false, "Обработка..."); // Используем ui.setSelectButtonState
                ui.clearUserMessages();

                try {
                    const listMoDataFromStore = getStoredListMoData();
                    const enrichmentPayload = {
                        started_data: item,
                        medical_orgs_list: listMoDataFromStore,
                    };

                    // Используем функцию из apiService
                    const enrichedDataForForm = await api.fetchEnrichedDataForPatient(enrichmentPayload);
                    console.log("[SearchLogic] Обогащенные данные:", enrichedDataForForm); // Лог есть в apiService

                    injectData(enrichedDataForForm, (injectionResults) => {
                    console.log("[SearchLogic] ВНУТРИ КОЛЛБЭКА injectData. injectionResults:", injectionResults);
                        ui.hideLoading(); // Скрываем прелоадер после завершения injectData
                        if (chrome.runtime.lastError) {
                            console.error("[SearchLogic] Ошибка executeScript:", chrome.runtime.lastError);
                            ui.showUserError("Ошибка при вставке данных: " + chrome.runtime.lastError.message);
                        } else if (injectionResults && injectionResults[0] && injectionResults[0].result) {
                            const result = injectionResults[0].result;
                            if (result.success) {
                                if (!result.allElementsFound) {
                                    ui.showUserMessage("Данные частично вставлены (не все поля найдены). Проверьте форму.", "info");
                                } else {
                                    window.close();
                                }
                            } else {
                                ui.showUserError("Ошибка при вставке данных на странице: " + (result.error || "Неизвестная ошибка"));
                            }
                        } else {
                            ui.showUserError("Не удалось получить результат операции вставки.");
                        }

                        if (!window.closed) {
                            console.log("[SearchLogic] Окно не закрыто, сброс состояния кнопки 'Выбрать'.");
                            ui.setSelectButtonState(selectButton, true, "Выбрать");
                        } else {
                            console.log("[SearchLogic] Окно было закрыто.");
                        }
                    });

                } catch (err) { // Ошибки от fetchEnrichedDataForPatient
                    console.error("[SearchLogic] Ошибка при обогащении:", err);
                    ui.showUserError(err.message); // err.message уже должен быть строкой от handleApiResponse
                    ui.setSelectButtonState(selectButton, true, "Выбрать");
                    ui.hideLoading(); // Убедимся, что лоадер скрыт
                }
            });
        });
    } catch (err) { // Ошибки от fetchSearchResults
        console.error("[SearchLogic] Ошибка API поиска:", err);
        ui.showUserError(err.message); // err.message уже должен быть строкой от handleApiResponse
        // ui.setSearchButtonState(true, "Искать"); // Вызывается в ui.showUserError
        // ui.hideLoading(); // Вызывается в ui.showUserError
    }
    // finally здесь больше не нужен, так как ui.showUserError и успешные ветки
    // должны корректно сбрасывать UI. Если какая-то ветка не сбрасывает,
    // то лучше добавить сброс в ту конкретную ветку.
    // Для подстраховки, если какая-то ошибка не поймана или UI не сброшен:
    const finalLoadingEl = document.getElementById("loading");
    if(finalLoadingEl && finalLoadingEl.style.display !== "none") ui.hideLoading();
    const finalSearchBtn = document.getElementById("searchBtn");
    if(finalSearchBtn && finalSearchBtn.disabled) ui.setSearchButtonState(true, "Искать");
}