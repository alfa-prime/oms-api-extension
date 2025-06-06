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
// import { insertData } from "./insert.js";

const API_URL = "http://0.0.0.0:8000/extension/search";

export async function searchPatient() {
  const searchBtn = document.getElementById("searchBtn");
  const messageEl = document.getElementById("message");
  const loadingEl = document.getElementById("loading");
  const resultsList = document.getElementById("results");

  // Считываем значения из формы
  const last_name = document.getElementById("lastname").value.trim();
  const first_name = document.getElementById("firstname").value.trim();
  const middle_name = document.getElementById("middlename").value.trim();
  const birthday = document.getElementById("birthday").value.trim();
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
  const payload = { last_name, start_date: startDate, end_date: endDate };
  if (first_name) payload.first_name = first_name;
  if (middle_name) payload.middle_name = middle_name;
  if (birthday) payload.birthday = birthday;

  try {
    // Запрос к API
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const results = await response.json();

    // Если вернулся не массив — ошибка
    if (!Array.isArray(results)) throw new Error("Записи не найдены");

    // ℹ️ Пустой результат — сообщаем
    if (results.length === 0) {
      showMessage("Записи не найдены", "info");
      return;
    }

    // Отрисовка каждого результата
    results.forEach((item, index) => {
      const person = `${item.Person_Surname} ${item.Person_Firname} ${item.Person_Secname} ${item.Person_Birthday}`;
      const card = item.EvnPS_NumCard;
      const hospDate = item.EvnPS_setDate;

      const li = document.createElement("li");
      li.innerHTML = `
        <div><strong>${person}</strong></div>
        <div><br></div>
        <div>Номер карты: ${card}</div>
        <div>Дата госпитализации: ${hospDate}</div>
        <div><br></div>
        <button class="select-btn" data-index="${index}">Выбрать</button>
      `;
      resultsList.appendChild(li);

      // Кнопка "Выбрать" вставляет данные на страницу
      li.querySelector("button").addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.scripting.executeScript(
            {
              target: { tabId: tabs[0].id },
              func: (data) => {
                console.log("Вставка данных", data);
                const iframe = document.querySelector("iframe"); // уточнить селектор, если их несколько
                if (!iframe) {
                  console.warn("iframe не найден");
                  return;
                }

                const doc = iframe.contentWindow.document;
                const map = {
                  'input[name="ReferralHospitalizationNumberTicket"]': "б/н",
                  'input[name="ReferralHospitalizationMedIndications"]':
                    "Нетипичное течение заболевания и (или) отсутствие эффекта",
                  'input[name="VidMpV008Code"]': "031",
                  'input[name="VidMpV008"]':
                    "специализированная медицинская помощь",
                  'input[name="CardNumber"]': "555",
                  'input[name="HospitalizationInfoNameDepartment"]':
                    data.LpuSection_Name,
                };

                for (const [selector, value] of Object.entries(map)) {
                  const el = doc.querySelector(selector);
                  if (el) {
                    el.value = value;
                    el.classList.remove("x-form-invalid-field");
                    el.setAttribute("aria-invalid", "false");
                    el.setAttribute("data-errorqtip", "");
                  } else {
                    console.warn("Не найден элемент:", selector);
                  }
                }
              },
              args: [item],
            },
            () => {
              // После вставки данных закрываем окно расширения
              window.close();
            },
          );
        });
      });
    });
  } catch (err) {
    console.error("Ошибка API:", err);
    showError(err.message);
  } finally {
    // Прячем прелоадер и возвращаем кнопку
    loadingEl.style.display = "none";
    searchBtn.disabled = false;
    searchBtn.textContent = "Искать";
  }
}
