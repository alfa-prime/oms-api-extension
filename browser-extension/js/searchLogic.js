// browser-extension/js/searchLogic.js

import * as ui from "./ui.js";
import * as api from "./apiService.js";
import { injectData } from "./pageInjector.js";

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

  const searchPayload = {
    last_name: lastName,
    start_date: startDate,
    end_date: endDate,
  };

  try {
    const results = await api.fetchSearchResults(searchPayload);
    if (!Array.isArray(results)) {
      console.error("[SearchLogic] API поиска вернул не массив:", results);
      throw new Error("Получен некорректный формат данных от сервера поиска.");
    }

    if (results.length === 0) {
      ui.showUserMessage("Записи не найдены", "info");
      return;
    }

    ui.hideLoading();
    ui.setSearchButtonState(true, "Искать");

    results.forEach((item) => {
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
            `;
      resultsList.appendChild(li);

      const selectButton = li.querySelector("button");
      selectButton.addEventListener("click", async () => {
        ui.showLoading();
        ui.setSelectButtonState(selectButton, false, "Обработка...");
        ui.clearUserMessages();

        try {
          const enrichmentPayload = {
            started_data: item,
          };
          const enrichedDataForForm =
            await api.fetchEnrichedDataForPatient(enrichmentPayload);
          console.log("[SearchLogic] Обогащенные данные:", enrichedDataForForm);

          injectData(enrichedDataForForm, (injectionResults) => {
            ui.hideLoading();

            const result = injectionResults?.[0]?.result;
            if (!result || !result.success) {
                const errorMsg = result?.error || chrome.runtime.lastError?.message || "Неизвестная ошибка вставки.";
                ui.showUserError("Ошибка при заполнении формы: " + errorMsg);
                ui.setSelectButtonState(selectButton, true, "Выбрать");
                return;
            }

            const operations = enrichedDataForForm.medical_service_data;

            if ((operations && operations.length > 0) || !result.allElementsFound) {
                // Если есть операции ИЛИ вставка была частичной, ОТКРЫВАЕМ НОВОЕ ОКНО
                let title = "Форма заполнена. Найдены операции:";
                if (operations && operations.length > 0) {
                    title = "Данные вставлены. Найдены операции:";
                } else {
                    title = "Данные успешно вставлены";
                }

                const url = new URL(chrome.runtime.getURL('final-view.html'));
                url.searchParams.set('title', encodeURIComponent(title));
                if (operations && operations.length > 0) {
                   url.searchParams.set('operations', encodeURIComponent(JSON.stringify(operations)));
                }

                // Расчет позиции для правого нижнего угла
                const width = 340;
                const height = 400;
                const rightOffset = 20; // Отступ от правого края в пикселях
                const bottomOffset = 20; // Отступ от нижнего края в пикселях
                const left = Math.round(screen.availWidth - width - rightOffset);
                const top = Math.round(screen.availHeight - height - bottomOffset);

                // Отправляем сообщение в background script для создания окна
                chrome.runtime.sendMessage({
                    action: 'createStickyWindow',
                    options: {
                        url: url.href,
                        width,
                        height,
                        left,
                        top
                    }
                });

                // И сразу закрываем текущий popup
                window.close();

            } else {
                // Если операций нет и вставка была ПОЛНОЙ, ЗАКРЫВАЕМ старый popup
                window.close();
            }
          });

        } catch (err) {
          console.error("[SearchLogic] Ошибка при обогащении:", err);
          ui.showUserError(err.message);
          ui.setSelectButtonState(selectButton, true, "Выбрать");
          ui.hideLoading();
        }
      });
    });
  } catch (err) {
    console.error("[SearchLogic] Ошибка API поиска:", err);
    ui.showUserError(err.message);
  } finally {
      const finalLoadingEl = document.getElementById("loading");
      if (finalLoadingEl && finalLoadingEl.style.display !== "none") ui.hideLoading();
      const finalSearchBtn = document.getElementById("searchBtn");
      if (finalSearchBtn && finalSearchBtn.disabled) ui.setSearchButtonState(true, "Искать");
  }
}