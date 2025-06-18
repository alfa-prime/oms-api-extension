// browser-extension/js/pageInjector.js

/**
 * Эта функция будет внедрена и выполнена на странице ГИС ОМС.
 * Она использует async/await для более чистого и последовательного выполнения шагов.
 * @param {object} dataMapToInsert - Карта данных для вставки.
 */
async function injectionTargetFunction(dataMapToInsert) {
    // ——— Вспомогательные функции ожидания (остаются без изменений) ———

    function waitForElement(doc, selector, timeout = 5000, interval = 100) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            (function check() {
                const el = doc.querySelector(selector);
                if (el) return resolve(el);
                if (Date.now() - start > timeout) {
                    return reject(new Error("Элемент не найден в DOM: " + selector));
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
                if (!mask || getComputedStyle(mask).display === 'none') {
                    return resolve();
                }
                if (Date.now() - start > timeout) {
                    return reject(new Error("Таймаут ожидания исчезновения маски загрузки (load mask)"));
                }
                setTimeout(check, 100);
            })();
        });
    }

    function waitForGridRowsSettled(doc, opts = {}) {
        const { timeout = 10000, stableDelay = 1500 } = opts;
        return new Promise((resolve, reject) => {
            let lastCount = -1; // Используем -1 для первого срабатывания
            let stableSince = Date.now();
            const start = Date.now();
            (function check() {
                const rows = doc.querySelectorAll("tr.x-grid-row");
                const count = rows.length;

                if (count !== lastCount) {
                    lastCount = count;
                    stableSince = Date.now();
                } else if (Date.now() - stableSince > stableDelay) {
                    return resolve(count); // Стабилизировалось
                }

                if (Date.now() - start > timeout) {
                    return reject(new Error(`Таймаут ожидания стабилизации строк в гриде (последнее кол-во: ${count})`));
                }
                setTimeout(check, 100);
            })();
        });
    }

    function waitForReferenceWindow(doc, isOpen, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            (function check() {
                const modal = [...doc.querySelectorAll(".x-window")].find(el =>
                    el.offsetParent !== null && el.innerText.includes("Выбор элемента")
                );
                const isCurrentlyOpen = !!modal;

                if (isCurrentlyOpen === isOpen) {
                    return resolve(modal);
                }
                if (Date.now() - start > timeout) {
                    return reject(new Error(`Таймаут ожидания ${isOpen ? 'открытия' : 'закрытия'} окна справочника.`));
                }
                setTimeout(check, 200);
            })();
        });
    }

    // ——— Функции заполнения полей (остаются без изменений) ———

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
        input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    }

    // ——— Основная функция селекта из справочника (переписана на async/await) ———

    async function selectFromReferenceField({ doc, iframeWindow, fieldSelector, column, value }) {
        const input = await waitForElement(doc, fieldSelector);
        input.focus();
        ["mousedown", "mouseup", "click"].forEach(evt =>
            input.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: iframeWindow }))
        );

        await waitForLoadMaskGone(doc);
        await waitForReferenceWindow(doc, true); // Ждем открытия
        await waitForGridRowsSettled(doc);

        const headerText = column.trim();
        const allInputs = Array.from(doc.querySelectorAll(".x-grid-header-ct input[type='text']"));
        const filterInput = allInputs.find(inp => {
          const colHdr = inp.closest(".x-column-header") || inp.closest("table")?.parentElement?.closest(".x-column-header");
          return colHdr?.querySelector(".x-column-header-text")?.textContent.trim() === headerText;
        });

        if (!filterInput) throw new Error(`Фильтр-инпут для колонки "${headerText}" не найден`);

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

        await waitForLoadMaskGone(doc);

        const gridSettledOpts = fieldSelector === "input[name='ReferralHospitalizationSendingDepartment']"
            ? { timeout: 20000, stableDelay: 2500 } : {};
        await waitForGridRowsSettled(doc, gridSettledOpts);

        const checker = doc.querySelector("tr.x-grid-row td.x-grid-cell-row-checker");
        if (!checker) throw new Error("Чекбокс для выбора строки в справочнике не найден");
        ["mousedown","mouseup","click"].forEach(evt =>
          checker.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: iframeWindow }))
        );

        const btn = Array.from(doc.querySelectorAll("span.x-btn-inner"))
          .find(s => s.textContent.trim() === "Выбрать")?.closest(".x-btn");
        if (!btn) throw new Error("Кнопка 'Выбрать' в справочнике не найдена");
        ["mousedown","mouseup","click"].forEach(evt =>
          btn.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: iframeWindow }))
        );

        await waitForReferenceWindow(doc, false); // Ждем закрытия
    }

    // ——— ОСНОВНОЙ ЗАПУСК (переписан на async/await) ———

    console.log("[PAGE INJECTOR] Вставка данных:", dataMapToInsert);

    const iframe = document.querySelector("iframe[name='mainFrame']") || document.querySelector("iframe");
    if (!iframe) {
        return { success: false, error: "Основной iframe не найден на странице." };
    }
    const doc = iframe.contentWindow.document;

    // Оборачиваем всю логику в try/catch для централизованной обработки ошибок
    try {
        // --- Последовательное заполнение полей из справочников ---
        await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='ReferralHospitalizationMedIndications']", column: "Код", value: dataMapToInsert["input[name='ReferralHospitalizationMedIndications']"] });
        await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='VidMpV008']", column: "Код", value: dataMapToInsert["input[name='VidMpV008']"] });
        await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='HospitalizationInfoV006']", column: "Код", value: dataMapToInsert["input[name='HospitalizationInfoV006']"] });
        await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='HospitalizationInfoV014']", column: "Код", value: dataMapToInsert["input[name='HospitalizationInfoV014']"] });

        // Условное заполнение необязательных полей
        let value; // Объявляем переменную для значений
        if (value = dataMapToInsert["input[name='HospitalizationInfoSpecializedMedicalProfile']"]) {
            await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='HospitalizationInfoSpecializedMedicalProfile']", column: "Код", value });
        }

        await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='HospitalizationInfoSubdivision']", column: "Краткое наименование", value: dataMapToInsert["input[name='HospitalizationInfoSubdivision']"] });
        await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='HospitalizationInfoDiagnosisMainDisease']", column: "Код МКБ", value: dataMapToInsert["input[name='HospitalizationInfoDiagnosisMainDisease']"] });
        await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='HospitalizationInfoV020']", column: "Код", value: dataMapToInsert["input[name='HospitalizationInfoV020']"] });

        if (value = dataMapToInsert["input[name='HospitalizationInfoC_ZABV027']"]) {
            await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='HospitalizationInfoC_ZABV027']", column: "Код", value });
        }

        await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='ResultV009']", column: "Код", value: dataMapToInsert["input[name='ResultV009']"] });
        await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='IshodV012']", column: "Код", value: dataMapToInsert["input[name='IshodV012']"] });

        if (value = dataMapToInsert["input[name='ReferralHospitalizationSendingDepartment']"]) {
            await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: "input[name='ReferralHospitalizationSendingDepartment']", column: "Реестровый номер", value });
        }

        // --- Заполнение простых полей и дат ---
        fillDateInput({ doc, selector: "input[name='ReferralHospitalizationDateTicket']", value: dataMapToInsert["input[name='ReferralHospitalizationDateTicket']"] });
        fillDateInput({ doc, selector: "input[name='DateBirth']", value: dataMapToInsert["input[name='DateBirth']"] });
        fillDateInput({ doc, selector: "input[name='TreatmentDateStart']", value: dataMapToInsert["input[name='TreatmentDateStart']"] });
        fillDateInput({ doc, selector: "input[name='TreatmentDateEnd']", value: dataMapToInsert["input[name='TreatmentDateEnd']"] });

        fillPlainInput(doc, "input[name='ReferralHospitalizationNumberTicket']", dataMapToInsert["input[name='ReferralHospitalizationNumberTicket']"]);
        fillPlainInput(doc, "input[name='Enp']", dataMapToInsert["input[name='Enp']"]);
        fillPlainInput(doc, "input[name='Gender']", dataMapToInsert["input[name='Gender']"]);
        fillPlainInput(doc, "input[name='HospitalizationInfoNameDepartment']", dataMapToInsert["input[name='HospitalizationInfoNameDepartment']"]);
        fillPlainInput(doc, "input[name='HospitalizationInfoOfficeCode']", dataMapToInsert["input[name='HospitalizationInfoOfficeCode']"]);
        fillPlainInput(doc, "input[name='CardNumber']", dataMapToInsert["input[name='CardNumber']"]);

        return { success: true };

    } catch (error) {
        console.error("[PAGE INJECTOR] Ошибка во время выполнения:", error);
        // Возвращаем текст ошибки для отображения в popup
        return { success: false, error: error.message || String(error) };
    }
}

/**
 * Эта функция вызывается из popup'а (searchLogic.js). Она не меняется.
 */
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