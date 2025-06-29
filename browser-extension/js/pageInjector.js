// browser-extension/js/pageInjector.js

/**
 * Эта функция будет внедрена и выполнена на странице ГИС ОМС.
 * Она использует async/await для более чистого и последовательного выполнения шагов.
 * @param {object} enrichedDataForForm - Полный объект с данными, включая операции.
 */
async function injectionTargetFunction(enrichedDataForForm) {
  const dataMapToInsert = enrichedDataForForm; // Используем весь объект
  let allElementsFound = true;

  // ——— Вспомогательные функции ожидания ———
  function waitForElement(doc, selector, timeout = 5000, interval = 100) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const el = doc.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeout) {
          console.warn("Элемент не найден в DOM:", selector);
          allElementsFound = false;
          resolve(null);
        }
        setTimeout(check, interval);
      })();
    });
  }

  function waitForLoadMaskGone(doc, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const mask = doc.querySelector(".x-mask-msg");
        if (!mask || getComputedStyle(mask).display === "none") {
          return resolve();
        }
        if (Date.now() - start > timeout) {
          return reject(
            new Error(
              "Таймаут ожидания исчезновения маски загрузки (load mask)",
            ),
          );
        }
        setTimeout(check, 100);
      })();
    });
  }

  function waitForGridRowsSettled(doc, opts = {}) {
    const { timeout = 10000, stableDelay = 1500 } = opts;
    return new Promise((resolve, reject) => {
      let lastCount = -1;
      let stableSince = Date.now();
      const start = Date.now();
      (function check() {
        const rows = doc.querySelectorAll("tr.x-grid-row");
        const count = rows.length;

        if (count !== lastCount) {
          lastCount = count;
          stableSince = Date.now();
        } else if (Date.now() - stableSince > stableDelay) {
          return resolve(count);
        }

        if (Date.now() - start > timeout) {
          return reject(
            new Error(
              `Таймаут ожидания стабилизации строк в гриде (последнее кол-во: ${count})`,
            ),
          );
        }
        setTimeout(check, 100);
      })();
    });
  }

  function waitForReferenceWindow(doc, isOpen, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const modal = [...doc.querySelectorAll(".x-window")].find(
          (el) =>
            el.offsetParent !== null && el.innerText.includes("Выбор элемента"),
        );
        const isCurrentlyOpen = !!modal;

        if (isCurrentlyOpen === isOpen) {
          return resolve(modal);
        }
        if (Date.now() - start > timeout) {
          return reject(
            new Error(
              `Таймаут ожидания ${isOpen ? "открытия" : "закрытия"} окна справочника.`,
            ),
          );
        }
        setTimeout(check, 200);
      })();
    });
  }

  // ——— Функции заполнения полей ———
  function fillPlainInput(doc, selector, value) {
    const inp = doc.querySelector(selector);
    if (!inp) {
      console.warn(`[PLAIN INPUT] Не найден элемент ${selector}`);
      allElementsFound = false;
      return;
    }
    inp.focus();
    inp.value = value;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    inp.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  }

  function fillDateInput({ doc, selector, value }) {
    const input = doc.querySelector(selector);
    if (!input) {
      allElementsFound = false;
      return;
    }
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  }

  async function selectFromDropdown({
    doc,
    iframeWindow,
    fieldSelector,
    value,
  }) {
    const input = await waitForElement(doc, fieldSelector);
    if (!input) return;

    const trigger = input
      .closest(".x-form-item-body")
      ?.querySelector(".x-form-trigger");
    if (!trigger) {
      throw new Error(
        `Триггер для выпадающего списка ${fieldSelector} не найден.`,
      );
    }

    ["mousedown", "mouseup", "click"].forEach((evt) =>
      trigger.dispatchEvent(
        new MouseEvent(evt, {
          bubbles: true,
          cancelable: true,
          view: iframeWindow,
        }),
      ),
    );

    const dropdownList = await waitForElement(
      doc,
      ".x-boundlist:not(.x-boundlist-hidden)",
      5000,
    );

    await waitForElement(dropdownList, ".x-boundlist-item", 2000);
    const options = Array.from(
      dropdownList.querySelectorAll(".x-boundlist-item"),
    );
    const targetOption = options.find(
      (opt) => opt.textContent.trim() === value,
    );

    if (!targetOption) {
      doc.body.click();
      throw new Error(
        `Опция "${value}" не найдена в выпадающем списке для ${fieldSelector}.`,
      );
    }

    ["mousedown", "mouseup", "click"].forEach((evt) =>
      targetOption.dispatchEvent(
        new MouseEvent(evt, {
          bubbles: true,
          cancelable: true,
          view: iframeWindow,
        }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async function selectFromReferenceField({
    doc,
    iframeWindow,
    fieldSelector,
    column,
    value,
  }) {
    const input = await waitForElement(doc, fieldSelector);
    if (!input) return;

    input.focus();
    ["mousedown", "mouseup", "click"].forEach((evt) =>
      input.dispatchEvent(
        new MouseEvent(evt, {
          bubbles: true,
          cancelable: true,
          view: iframeWindow,
        }),
      ),
    );

    await waitForLoadMaskGone(doc);
    await waitForReferenceWindow(doc, true);
    await waitForGridRowsSettled(doc);

    const headerText = column.trim();
    const allInputs = Array.from(
      doc.querySelectorAll(".x-grid-header-ct input[type='text']"),
    );
    const filterInput = allInputs.find((inp) => {
      const colHdr =
        inp.closest(".x-column-header") ||
        inp.closest("table")?.parentElement?.closest(".x-column-header");
      return (
        colHdr?.querySelector(".x-column-header-text")?.textContent.trim() ===
        headerText
      );
    });

    if (!filterInput)
      throw new Error(`Фильтр-инпут для колонки "${headerText}" не найден`);

    filterInput.focus();
    filterInput.value = value;
    filterInput.dispatchEvent(new Event("input", { bubbles: true }));
    filterInput.dispatchEvent(new Event("change", { bubbles: true }));
    ["keydown", "keypress", "keyup"].forEach((type) =>
      filterInput.dispatchEvent(
        new KeyboardEvent(type, {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    filterInput.blur();

    await waitForLoadMaskGone(doc);

    const gridSettledOpts =
      fieldSelector === "input[name='ReferralHospitalizationSendingDepartment']"
        ? { timeout: 20000, stableDelay: 2500 }
        : {};
    await waitForGridRowsSettled(doc, gridSettledOpts);

    const checker = doc.querySelector(
      "tr.x-grid-row td.x-grid-cell-row-checker",
    );
    if (!checker)
      throw new Error(
        `Чекбокс для выбора строки в справочнике не найден (значение: ${value})`,
      );
    ["mousedown", "mouseup", "click"].forEach((evt) =>
      checker.dispatchEvent(
        new MouseEvent(evt, {
          bubbles: true,
          cancelable: true,
          view: iframeWindow,
        }),
      ),
    );

    const btn = Array.from(doc.querySelectorAll("span.x-btn-inner"))
      .find((s) => s.textContent.trim() === "Выбрать")
      ?.closest(".x-btn");
    if (!btn) throw new Error("Кнопка 'Выбрать' в справочнике не найдена");
    ["mousedown", "mouseup", "click"].forEach((evt) =>
      btn.dispatchEvent(
        new MouseEvent(evt, {
          bubbles: true,
          cancelable: true,
          view: iframeWindow,
        }),
      ),
    );

    await waitForReferenceWindow(doc, false);
  }

  // ——— ОСНОВНОЙ ЗАПУСК ———
  console.log("[PAGE INJECTOR] Вставка данных:", dataMapToInsert);

  const iframe = document.querySelector("iframe[name='mainFrame']") || document.querySelector("iframe");
  if (!iframe) {
    chrome.runtime.sendMessage({ action: 'injectionError', error: "Основной iframe не найден на странице." });
    return;
  }
  const doc = iframe.contentWindow.document;

  try {
    let value; // Объявляем переменную для значений один раз
    // --- Последовательное и УСЛОВНОЕ заполнение полей из справочников ---
    if ((value = dataMapToInsert["input[name='ReferralHospitalizationMedIndications']"])) {
      await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='ReferralHospitalizationMedIndications']", column: "Код", value });
    }
    if ((value = dataMapToInsert["input[name='VidMpV008']"])) {
      await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='VidMpV008']", column: "Код", value });
    }
    if ((value = dataMapToInsert["input[name='HospitalizationInfoV006']"])) {
      await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='HospitalizationInfoV006']", column: "Код", value });
    }
    if ((value = dataMapToInsert["input[name='HospitalizationInfoV014']"])) {
      await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='HospitalizationInfoV014']", column: "Код", value });
    }
    if ((value = dataMapToInsert["input[name='HospitalizationInfoSpecializedMedicalProfile']"])) {
      await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='HospitalizationInfoSpecializedMedicalProfile']", column: "Код", value });
    }
    if ((value = dataMapToInsert["input[name='HospitalizationInfoSubdivision']"])) {
      await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='HospitalizationInfoSubdivision']", column: "Краткое наименование", value });
    }
    if ((value = dataMapToInsert["input[name='HospitalizationInfoDiagnosisMainDisease']"])) {
      await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='HospitalizationInfoDiagnosisMainDisease']", column: "Код МКБ", value });
    }
    if ((value = dataMapToInsert["input[name='HospitalizationInfoV020']"])) {
      await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='HospitalizationInfoV020']", column: "Код", value });
    }
    if ((value = dataMapToInsert["input[name='HospitalizationInfoC_ZABV027']"])) {
      await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='HospitalizationInfoC_ZABV027']", column: "Код", value });
    }
    if ((value = dataMapToInsert["input[name='ResultV009']"])) {
      await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='ResultV009']", column: "Код", value });
    }
    if ((value = dataMapToInsert["input[name='IshodV012']"])) {
      await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='IshodV012']", column: "Код", value });
    }
    if ((value = dataMapToInsert["input[name='ReferralHospitalizationSendingDepartment']"])) {
      await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='ReferralHospitalizationSendingDepartment']", column: "Реестровый номер", value });
    }
    // --- Условное заполнение простых полей и дат ---
    if ((value = dataMapToInsert["input[name='ReferralHospitalizationDateTicket']"])) {
      fillDateInput({ doc, selector: "input[name='ReferralHospitalizationDateTicket']", value });
    }
    if ((value = dataMapToInsert["input[name='DateBirth']"])) {
      fillDateInput({ doc, selector: "input[name='DateBirth']", value });
    }
    if ((value = dataMapToInsert["input[name='TreatmentDateStart']"])) {
      fillDateInput({ doc, selector: "input[name='TreatmentDateStart']", value });
    }
    if ((value = dataMapToInsert["input[name='TreatmentDateEnd']"])) {
      fillDateInput({ doc, selector: "input[name='TreatmentDateEnd']", value });
    }
    if ((value = dataMapToInsert["input[name='ReferralHospitalizationNumberTicket']"])) {
      fillPlainInput( doc, "input[name='ReferralHospitalizationNumberTicket']", value );
    }
    if ((value = dataMapToInsert["input[name='Enp']"])) {
      fillPlainInput(doc, "input[name='Enp']", value);
    }
    if ((value = dataMapToInsert["input[name='Gender']"])) {
      await selectFromDropdown({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='Gender']", value });
    }
    if ((value = dataMapToInsert["input[name='HospitalizationInfoNameDepartment']"])) {
      fillPlainInput( doc, "input[name='HospitalizationInfoNameDepartment']", value );
    }
    if ((value = dataMapToInsert["input[name='HospitalizationInfoOfficeCode']"])) {
      fillPlainInput(doc, "input[name='HospitalizationInfoOfficeCode']", value);
    }
    if ((value = dataMapToInsert["input[name='CardNumber']"])) {
      fillPlainInput(doc, "input[name='CardNumber']", value);
    }


    // --- Отправка сообщения о результате В КОНЦЕ ---
    const operations = dataMapToInsert.medical_service_data;
    const diagnoses = dataMapToInsert.additional_diagnosis_data;

    const hasOperations = operations && operations.length > 0;
    const hasDiagnoses = diagnoses && diagnoses.length > 0;

    if (hasOperations || hasDiagnoses || !allElementsFound) {
      let title = "";
      if (hasOperations && hasDiagnoses) {
          title += "Найдены сопутствующие диагнозы и операционные услуги:";
      } else if (hasOperations) {
          title += "Найдены операционные услуги:";
      } else if (hasDiagnoses) {
          title += "Найдены сопутствующие диагнозы:";
      } else {
          title = "Данные вставлены.";
      }

      chrome.runtime.sendMessage({
        action: 'showFinalResultInPage',
        data: { title, operations, diagnoses } // Передаем и операции, и диагнозы
      });
    }

    return { success: true };

  } catch (error) {
    console.error("[PAGE INJECTOR] Ошибка во время выполнения:", error);
    chrome.runtime.sendMessage({ action: 'injectionError', error: error.message || String(error) });
    return { success: false, error: error.message || String(error) };
  }
}

export function injectData(enrichedDataForForm) { // Убираем колбэк
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError || !tabs || !tabs.length) {
      console.error("[PAGE INJECTOR] Ошибка chrome.tabs.query:", chrome.runtime.lastError?.message);
      return;
    }
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: injectionTargetFunction,
      args: [enrichedDataForForm], // Передаем все данные
    });
  });
}