// browser-extension/js/pageInjector.js

function injectionTargetFunction(dataMapToInsert) {
  function waitForElement(doc, selector, timeout = 5000, interval = 100) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const el = doc.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeout)
          return reject("Элемент не найден: " + selector);
        setTimeout(check, interval);
      };
      check();
    });
  }

  function waitForReferenceWindowClose(doc, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const modalSelector = ".x-window";

      const check = () => {
        const modal = [...doc.querySelectorAll(modalSelector)].find((el) =>
          el.innerText.includes("Выбор элемента"),
        );

        const isClosed =
          !modal ||
          getComputedStyle(modal).display === "none" ||
          modal.offsetParent === null;

        if (isClosed) return resolve("Окно справочника закрылось");

        if (Date.now() - start > timeout)
          return reject("Таймаут ожидания закрытия окна справочника");

        setTimeout(check, 200);
      };

      check();
    });
  }

  function selectFromReferenceField({
    doc,
    iframeWindow,
    fieldSelector,
    column,
    value,
  }) {
    return new Promise((resolve, reject) => {
      waitForElement(doc, fieldSelector)
        .then((input) => {
          try {
            input.focus();
            ["mousedown", "mouseup", "click"].forEach((eventType) => {
              input.dispatchEvent(
                new MouseEvent(eventType, {
                  bubbles: true,
                  cancelable: true,
                  view: iframeWindow,
                }),
              );
            });
            console.log(`[REFERENCE] Клик по полю ${fieldSelector}`);

            setTimeout(() => {
              const headerText = column.trim();
              const allInputs = doc.querySelectorAll(
                ".x-grid-header-ct input[type='text']",
              );

              let filterInput = null;
              for (const inputEl of allInputs) {
                const columnEl =
                  inputEl.closest(".x-column-header") ||
                  inputEl
                    .closest("table")
                    ?.parentElement?.closest(".x-column-header");
                const textSpan = columnEl?.querySelector(
                  ".x-column-header-text",
                );
                if (textSpan?.textContent.trim() === headerText) {
                  filterInput = inputEl;
                  break;
                }
              }

              if (!filterInput) return reject("Фильтр-инпут не найден");

              filterInput.value = value;
              filterInput.dispatchEvent(new Event("input", { bubbles: true }));
              filterInput.dispatchEvent(new Event("change", { bubbles: true }));
              filterInput.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "Enter",
                  keyCode: 13,
                  which: 13,
                  bubbles: true,
                  cancelable: true,
                }),
              );

              setTimeout(() => {
                const checkerTd = doc.querySelector(
                  "tr.x-grid-row td.x-grid-cell-row-checker",
                );
                if (!checkerTd) return reject("Чекбокс строки не найден");

                ["mousedown", "mouseup", "click"].forEach((evt) => {
                  checkerTd.dispatchEvent(
                    new MouseEvent(evt, {
                      bubbles: true,
                      cancelable: true,
                      view: iframeWindow,
                    }),
                  );
                });

                setTimeout(() => {
                  const btnSpan = [
                    ...doc.querySelectorAll("span.x-btn-inner"),
                  ].find((span) => span.textContent.trim() === "Выбрать");
                  const btn = btnSpan?.closest(".x-btn");
                  if (!btn) return reject("Кнопка 'Выбрать' не найдена");

                  ["mousedown", "mouseup", "click"].forEach((evt) =>
                    btn.dispatchEvent(
                      new MouseEvent(evt, {
                        bubbles: true,
                        cancelable: true,
                        view: iframeWindow,
                      }),
                    ),
                  );

                  resolve("Успех");
                }, 500);
              }, 1000);
            }, 1000);
          } catch (e) {
            reject(e);
          }
        })
        .catch((err) => {
          console.warn(`[REFERENCE] ${err}`);
          reject(err);
        });
    });
  }

  function fillDateInput({ doc, selector, value, iframeWindow }) {
    const input = doc.querySelector(selector);
    if (!input) {
      console.warn(`[DATE FILLER] Не найден элемент: ${selector}`);
      return;
    }

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
      }),
    );

    input.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "Tab",
        keyCode: 9,
        which: 9,
        bubbles: true,
        cancelable: true,
      }),
    );

    input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));

    console.log(`[DATE FILLER] Дата успешно вставлена в ${selector}`);
  }

  console.log(
    "[PAGE INJECTOR - Injected Script] Вставка данных:",
    dataMapToInsert,
  );

  let iframe =
    document.querySelector("iframe[name='mainFrame']") ||
    document.querySelector("iframe#mainFrame") ||
    document.querySelector("iframe");

  if (!iframe) {
    console.warn("[PAGE INJECTOR] iframe не найден");
    return { success: false, error: "iframe не найден на целевой странице" };
  }

  const doc = iframe.contentWindow.document;
  if (!doc) {
    console.warn("[PAGE INJECTOR] Не удалось получить document из iframe");
    return { success: false, error: "Не удалось получить document из iframe" };
  }

  return selectFromReferenceField({
    doc,
    iframeWindow: iframe.contentWindow,
    fieldSelector: "input[name='ReferralHospitalizationMedIndications']",
    column: "Код",
    value:
      dataMapToInsert["input[name='ReferralHospitalizationMedIndications']"] ||
      "",
  })
    .then(() => waitForReferenceWindowClose(doc, 5000))
    .then(() => {
      return selectFromReferenceField({
        doc,
        iframeWindow: iframe.contentWindow,
        fieldSelector: "input[name='VidMpV008']",
        column: "Код",
        value: dataMapToInsert["input[name='VidMpV008']"] || "",
      });
    })
    .then(() => waitForReferenceWindowClose(doc, 5000))
    .then(() => {
      return selectFromReferenceField({
        doc,
        iframeWindow: iframe.contentWindow,
        fieldSelector: "input[name='HospitalizationInfoV006']",
        column: "Код",
        value: dataMapToInsert["input[name='HospitalizationInfoV006']"] || "",
      });
    })
    .then(() => waitForReferenceWindowClose(doc, 5000))
    .then(() => {
      return selectFromReferenceField({
        doc,
        iframeWindow: iframe.contentWindow,
        fieldSelector: "input[name='HospitalizationInfoV014']",
        column: "Код",
        value: dataMapToInsert["input[name='HospitalizationInfoV014']"] || "",
      });
    })
    .then(() => waitForReferenceWindowClose(doc, 5000))
    .then(() => {
      return selectFromReferenceField({
        doc,
        iframeWindow: iframe.contentWindow,
        fieldSelector: "input[name='HospitalizationInfoSubdivision']",
        column: "Краткое наименование",
        value:
          dataMapToInsert["input[name='HospitalizationInfoSubdivision']"] || "",
      });
    })
    .then(() => waitForReferenceWindowClose(doc, 5000))
    .then(() => {
      return selectFromReferenceField({
        doc,
        iframeWindow: iframe.contentWindow,
        fieldSelector: "input[name='HospitalizationInfoDiagnosisMainDisease']",
        column: "Код МКБ",
        value:
          dataMapToInsert[
            "input[name='HospitalizationInfoDiagnosisMainDisease']"
          ] || "",
      });
    })
    .then(() => waitForReferenceWindowClose(doc, 5000))
    .then(() => {
      return selectFromReferenceField({
        doc,
        iframeWindow: iframe.contentWindow,
        fieldSelector: "input[name='HospitalizationInfoV020']",
        column: "Код",
        value: dataMapToInsert["input[name='HospitalizationInfoV020']"] || "",
      });
    })
    .then(() => waitForReferenceWindowClose(doc, 5000))
    .then(() => {
      const value =
        dataMapToInsert["input[name='HospitalizationInfoC_ZABV027']"];
      if (value) {
        return selectFromReferenceField({
          doc,
          iframeWindow: iframe.contentWindow,
          fieldSelector: "input[name='HospitalizationInfoC_ZABV027']",
          column: "Код",
          value,
        }).then(() => waitForReferenceWindowClose(doc, 5000));
      } else {
        console.log(
          "[SKIP] HospitalizationInfoC_ZABV027 пропущен (нет значения)",
        );
        return Promise.resolve();
      }
    })
    .then(() => waitForReferenceWindowClose(doc, 5000))
    .then(() => {
      return selectFromReferenceField({
        doc,
        iframeWindow: iframe.contentWindow,
        fieldSelector: "input[name='ResultV009']",
        column: "Код",
        value: dataMapToInsert["input[name='ResultV009']"] || "",
      });
    })
    .then(() => waitForReferenceWindowClose(doc, 5000))
    .then(() => {
      return selectFromReferenceField({
        doc,
        iframeWindow: iframe.contentWindow,
        fieldSelector: "input[name='IshodV012']",
        column: "Код",
        value: dataMapToInsert["input[name='IshodV012']"] || "",
      });
    })
    .then(() => waitForReferenceWindowClose(doc, 5000))
    .then(() => {
      let allElementsFound = true;

      const skipSelectors = [
        "input[name='ReferralHospitalizationMedIndications']",
        "input[name='VidMpV008']",
        "input[name='HospitalizationInfoV006']",
        "input[name='HospitalizationInfoSubdivision']",
        "input[name='HospitalizationInfoDiagnosisMainDisease']",
        "input[name='ResultV009']",
        "input[name='HospitalizationInfoV020']",
        "input[name='HospitalizationInfoV014']",
        "input[name='IshodV012']",
        "input[name='ReferralHospitalizationDateTicket']",
        "input[name='DateBirth']",
        "input[name='TreatmentDateEnd']",
        "input[name='TreatmentDateStart']",
        "input[name='HospitalizationInfoC_ZABV027']",
      ];

      if (dataMapToInsert["input[name='ReferralHospitalizationDateTicket']"]) {
        fillDateInput({
          doc,
          selector: "input[name='ReferralHospitalizationDateTicket']",
          value:
            dataMapToInsert["input[name='ReferralHospitalizationDateTicket']"],
          iframeWindow: iframe.contentWindow,
        });
      }

      if (dataMapToInsert["input[name='DateBirth']"]) {
        fillDateInput({
          doc,
          selector: "input[name='DateBirth']",
          value: dataMapToInsert["input[name='DateBirth']"],
          iframeWindow: iframe.contentWindow,
        });
      }

      if (dataMapToInsert["input[name='TreatmentDateEnd']"]) {
        fillDateInput({
          doc,
          selector: "input[name='TreatmentDateEnd']",
          value: dataMapToInsert["input[name='TreatmentDateEnd']"],
          iframeWindow: iframe.contentWindow,
        });
      }

      if (dataMapToInsert["input[name='TreatmentDateStart']"]) {
        fillDateInput({
          doc,
          selector: "input[name='TreatmentDateStart']",
          value: dataMapToInsert["input[name='TreatmentDateStart']"],
          iframeWindow: iframe.contentWindow,
        });
      }

      for (const [selector, valueToInsert] of Object.entries(dataMapToInsert)) {
        if (skipSelectors.includes(selector)) continue;
        try {
          const el = doc.querySelector(selector);
          if (el) {
            el.value = valueToInsert;
            el.classList.remove("x-form-invalid-field");
            el.removeAttribute("aria-invalid");
            el.removeAttribute("data-errorqtip");
          } else {
            console.warn(`[PAGE INJECTOR] Не найден элемент: ${selector}`);
            allElementsFound = false;
          }
        } catch (e) {
          console.error(`[PAGE INJECTOR] Ошибка на селекторе ${selector}:`, e);
          allElementsFound = false;
        }
      }

      return { success: true, allElementsFound };
    })
    .catch((error) => {
      console.error("[PAGE INJECTOR] Ошибка справочника:", error);
      return { success: false, error };
    });
}

export function injectData(dataToInsert, callbackAfterInjection) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error(
        "[PAGE INJECTOR] Ошибка chrome.tabs.query:",
        chrome.runtime.lastError.message,
      );
      if (typeof callbackAfterInjection === "function")
        callbackAfterInjection();
      return;
    }

    if (!tabs || !tabs.length) {
      console.error("[PAGE INJECTOR] Нет активной вкладки");
      if (typeof callbackAfterInjection === "function")
        callbackAfterInjection();
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        func: injectionTargetFunction,
        args: [dataToInsert],
      },
      (injectionResults) => {
        console.log("[PAGE INJECTOR] injectionResults:", injectionResults);
        if (typeof callbackAfterInjection === "function")
          callbackAfterInjection(injectionResults);
      },
    );
  });
}
