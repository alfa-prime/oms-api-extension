// browser-extension/js/pageInjector.js

function injectionTargetFunction(dataMapToInsert) {
  // ——— вспомогательные ожидалки ———

  function waitForElement(doc, selector, timeout = 5000, interval = 100) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const el = doc.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeout)
          return reject("Элемент не найден: " + selector);
        setTimeout(check, interval);
      })();
    });
  }

  function waitForReferenceWindowOpen(doc, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const filters = doc.querySelectorAll(
          ".x-grid-header-ct input[type='text']"
        );
        if (filters.length > 0) return resolve();
        if (Date.now() - start > timeout)
          return reject("Таймаут ожидания открытия справочника");
        setTimeout(check, 100);
      })();
    });
  }

  function waitForLoadMaskGone(doc, timeout = 5000, interval = 100) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const mask = doc.querySelector(".x-mask-msg");
        if (!mask || getComputedStyle(mask).display === "none") {
          return resolve();
        }
        if (Date.now() - start > timeout) {
          return reject("Таймаут ожидания исчезновения load mask");
        }
        setTimeout(check, interval);
      })();
    });
  }

  /**
   * Ждёт, пока количество строк в гриде стабилизируется.
   */
  function waitForGridRowsSettled(doc, opts = {}) {
    const { timeout = 10000, stableDelay = 1500 } = opts;
    return new Promise((resolve, reject) => {
      let lastCount = 0;
      let stableSince = Date.now();
      const start = Date.now();
      (function check() {
        const rows = doc.querySelectorAll("tr.x-grid-row");
        const count = rows.length;
        if (count > 0) {
          if (count !== lastCount) {
            lastCount = count;
            stableSince = Date.now();
          } else if (Date.now() - stableSince > stableDelay) {
            return resolve(count);
          }
        }
        if (Date.now() - start > timeout) {
          return reject(`Таймаут ожидания строк (последнее: ${count})`);
        }
        setTimeout(check, 100);
      })();
    });
  }

  function waitForReferenceWindowClose(doc, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const modal = [...doc.querySelectorAll(".x-window")].find(el =>
          el.innerText.includes("Выбор элемента")
        );
        const closed =
          !modal ||
          getComputedStyle(modal).display === "none" ||
          modal.offsetParent === null;
        if (closed) return resolve();
        if (Date.now() - start > timeout)
          return reject("Таймаут ожидания закрытия окна справочника");
        setTimeout(check, 200);
      })();
    });
  }

  // ——— функции заполнения полей ———

  function fillPlainInput(doc, selector, value) {
    const inp = doc.querySelector(selector);
    if (!inp) {
      console.warn(`[PLAIN INPUT] Не найден элемент ${selector}`);
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
    if (!input) return;
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        keyCode: 9,
        which: 9,
        bubbles: true,
        cancelable: true,
      })
    );
    input.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "Tab",
        keyCode: 9,
        which: 9,
        bubbles: true,
        cancelable: true,
      })
    );
    input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  }

  // ——— основная функция селекта из справочника ———

  function selectFromReferenceField({ doc, iframeWindow, fieldSelector, column, value }) {
    return waitForElement(doc, fieldSelector)
      .then(input => {
        input.focus();
        ["mousedown", "mouseup", "click"].forEach(evt =>
          input.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: iframeWindow }))
        );
      })
      .then(() => waitForLoadMaskGone(doc))
      .then(() => waitForReferenceWindowOpen(doc))
      .then(() => waitForGridRowsSettled(doc))
      .then(() => {
        // вводим фильтр и полный Enter
        const headerText = column.trim();
        const allInputs = Array.from(doc.querySelectorAll(".x-grid-header-ct input[type='text']"));
        const filterInput = allInputs.find(inp => {
          const colHdr = inp.closest(".x-column-header")
                      || inp.closest("table")?.parentElement?.closest(".x-column-header");
          return colHdr?.querySelector(".x-column-header-text")?.textContent.trim() === headerText;
        });
        if (!filterInput) throw "Фильтр-инпут не найден";

        filterInput.focus();
        filterInput.value = value;
        filterInput.dispatchEvent(new Event("input", { bubbles: true }));
        filterInput.dispatchEvent(new Event("change", { bubbles: true }));
        ["keydown","keypress","keyup"].forEach(type =>
          filterInput.dispatchEvent(new KeyboardEvent(type, {
            key: "Enter", code: "Enter", keyCode: 13, which: 13,
            bubbles: true, cancelable: true
          }))
        );
        filterInput.blur();
      })
      .then(() => waitForLoadMaskGone(doc))
      .then(() => waitForGridRowsSettled(
        doc,
        fieldSelector === "input[name='ReferralHospitalizationSendingDepartment']"
          ? { timeout: 20000, stableDelay: 2500 }
          : {}
      ))
      .then(() => {
        // кликаем чекбокс
        const checker = doc.querySelector("tr.x-grid-row td.x-grid-cell-row-checker");
        if (!checker) throw "Чекбокс строки не найден";
        ["mousedown","mouseup","click"].forEach(evt =>
          checker.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: iframeWindow }))
        );
      })
      .then(() => {
        // кликаем "Выбрать"
        const btn = Array.from(doc.querySelectorAll("span.x-btn-inner"))
          .find(s => s.textContent.trim() === "Выбрать")?.closest(".x-btn");
        if (!btn) throw "Кнопка 'Выбрать' не найдена";
        ["mousedown","mouseup","click"].forEach(evt =>
          btn.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: iframeWindow }))
        );
      })
      .then(() => waitForReferenceWindowClose(doc))
      .then(() => "Успех");
  }

  // ——— основной запуск ———

  console.log("[PAGE INJECTOR] Вставка данных:", dataMapToInsert);

  const iframe =
    document.querySelector("iframe[name='mainFrame']") ||
    document.querySelector("iframe#mainFrame") ||
    document.querySelector("iframe");
  if (!iframe) {
    console.warn("[PAGE INJECTOR] iframe не найден");
    return Promise.resolve({ success: false, error: "iframe не найден" });
  }
  const doc = iframe.contentWindow.document;

  return selectFromReferenceField({
    doc,
    iframeWindow: iframe.contentWindow,
    fieldSelector: "input[name='ReferralHospitalizationMedIndications']",
    column: "Код",
    value: dataMapToInsert["input[name='ReferralHospitalizationMedIndications']"] || "",
  })
    .then(() => selectFromReferenceField({
      doc,
      iframeWindow: iframe.contentWindow,
      fieldSelector: "input[name='VidMpV008']",
      column: "Код",
      value: dataMapToInsert["input[name='VidMpV008']"] || "",
    }))
    .then(() => selectFromReferenceField({
      doc,
      iframeWindow: iframe.contentWindow,
      fieldSelector: "input[name='HospitalizationInfoV006']",
      column: "Код",
      value: dataMapToInsert["input[name='HospitalizationInfoV006']"] || "",
    }))
    .then(() => selectFromReferenceField({
      doc,
      iframeWindow: iframe.contentWindow,
      fieldSelector: "input[name='HospitalizationInfoV014']",
      column: "Код",
      value: dataMapToInsert["input[name='HospitalizationInfoV014']"] || "",
    }))
    .then(() => selectFromReferenceField({
      doc,
      iframeWindow: iframe.contentWindow,
      fieldSelector: "input[name='HospitalizationInfoSubdivision']",
      column: "Краткое наименование",
      value: dataMapToInsert["input[name='HospitalizationInfoSubdivision']"] || "",
    }))
    .then(() => selectFromReferenceField({
      doc,
      iframeWindow: iframe.contentWindow,
      fieldSelector: "input[name='HospitalizationInfoDiagnosisMainDisease']",
      column: "Код МКБ",
      value: dataMapToInsert["input[name='HospitalizationInfoDiagnosisMainDisease']"] || "",
    }))
    .then(() => selectFromReferenceField({
      doc,
      iframeWindow: iframe.contentWindow,
      fieldSelector: "input[name='HospitalizationInfoV020']",
      column: "Код",
      value: dataMapToInsert["input[name='HospitalizationInfoV020']"] || "",
    }))
    .then(() => {
      const v = dataMapToInsert["input[name='HospitalizationInfoC_ZABV027']"];
      return v
        ? selectFromReferenceField({
            doc,
            iframeWindow: iframe.contentWindow,
            fieldSelector: "input[name='HospitalizationInfoC_ZABV027']",
            column: "Код",
            value: v,
          })
        : Promise.resolve();
    })
    .then(() => selectFromReferenceField({
      doc,
      iframeWindow: iframe.contentWindow,
      fieldSelector: "input[name='ResultV009']",
      column: "Код",
      value: dataMapToInsert["input[name='ResultV009']"] || "",
    }))
    .then(() => selectFromReferenceField({
      doc,
      iframeWindow: iframe.contentWindow,
      fieldSelector: "input[name='IshodV012']",
      column: "Код",
      value: dataMapToInsert["input[name='IshodV012']"] || "",
    }))
    .then(() => {
      const v = dataMapToInsert["input[name='ReferralHospitalizationSendingDepartment']"];
      return v
        ? selectFromReferenceField({
            doc,
            iframeWindow: iframe.contentWindow,
            fieldSelector: "input[name='ReferralHospitalizationSendingDepartment']",
            column: "Реестровый номер",
            value: v,
          })
        : Promise.resolve();
    })
    .then(() => {
      // ——— Заполняем даты ———
      if (dataMapToInsert["input[name='ReferralHospitalizationDateTicket']"]) {
        fillDateInput({
          doc,
          selector: "input[name='ReferralHospitalizationDateTicket']",
          value: dataMapToInsert["input[name='ReferralHospitalizationDateTicket']"],
        });
      }
      if (dataMapToInsert["input[name='DateBirth']"]) {
        fillDateInput({
          doc,
          selector: "input[name='DateBirth']",
          value: dataMapToInsert["input[name='DateBirth']"],
        });
      }
      if (dataMapToInsert["input[name='TreatmentDateStart']"]) {
        fillDateInput({
          doc,
          selector: "input[name='TreatmentDateStart']",
          value: dataMapToInsert["input[name='TreatmentDateStart']"],
        });
      }
      if (dataMapToInsert["input[name='TreatmentDateEnd']"]) {
        fillDateInput({
          doc,
          selector: "input[name='TreatmentDateEnd']",
          value: dataMapToInsert["input[name='TreatmentDateEnd']"],
        });
      }

      // ——— Заполняем дополнительные plain-input’ы и закрываем попап ———
      fillPlainInput(doc, "input[name='ReferralHospitalizationNumberTicket']",
        dataMapToInsert["input[name='ReferralHospitalizationNumberTicket']"] || ""
      );
      fillPlainInput(doc, "input[name='Enp']",
        dataMapToInsert["input[name='Enp']"] || ""
      );
      fillPlainInput(doc, "input[name='Gender']",
        dataMapToInsert["input[name='Gender']"] || ""
      );
      fillPlainInput(doc, "input[name='HospitalizationInfoNameDepartment']",
        dataMapToInsert["input[name='HospitalizationInfoNameDepartment']"] || ""
      );
      fillPlainInput(doc, "input[name='HospitalizationInfoOfficeCode']",
        dataMapToInsert["input[name='HospitalizationInfoOfficeCode']"] || ""
      );
      fillPlainInput(doc, "input[name='CardNumber']",
        dataMapToInsert["input[name='CardNumber']"] || ""
      );


      return { success: true };
    })
    .catch(error => {
      console.error("[PAGE INJECTOR] Ошибка:", error);
      return { success: false, error };
    });
}

export function injectData(dataMapToInsert, callbackAfterInjection) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error("[PAGE INJECTOR] Ошибка chrome.tabs.query:", chrome.runtime.lastError.message);
      if (typeof callbackAfterInjection === "function") callbackAfterInjection();
      return;
    }
    if (!tabs || !tabs.length) {
      console.error("[PAGE INJECTOR] Нет активной вкладки");
      if (typeof callbackAfterInjection === "function") callbackAfterInjection();
      return;
    }
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: injectionTargetFunction,
      args: [dataMapToInsert],
    }, (results) => {
      console.log("[PAGE INJECTOR] injectionResults:", results);
      if (typeof callbackAfterInjection === "function") callbackAfterInjection(results);
    });
  });
}
