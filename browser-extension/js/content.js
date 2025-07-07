// browser-extension/js/content.js

const CONTAINER_ID = 'evmias-oms-result-container';
const STYLE_ID = 'evmias-oms-result-styles';

/**
 * Функция для удаления нашей панели и стилей.
 */
function removeInjectedElements() {
    const container = document.getElementById(CONTAINER_ID);
    if (container) {
        container.remove();
    }
    const styleSheet = document.getElementById(STYLE_ID);
    if (styleSheet) {
        styleSheet.remove();
    }
}

/**
 * Функция для создания и вставки блока с результатами.
 * @param {string} title - Заголовок блока.
 * @param {Array<object>} operations - Массив с данными об операциях.
 * @param {Array<object>} diagnoses - Массив с данными о диагнозах.
 */
function injectResultBlock(title, operations, diagnoses, discharge) {
    removeInjectedElements();

    const styles = `
        #${CONTAINER_ID} {
            position: sticky;
            top: 0;
            left: 0;
            width: 100%;
            padding: 12px 20px;
            background-color: #fdf6e3;
            border-bottom: 2px solid #cb4b16;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 12px;
            color: #586e75;
            box-sizing: border-box;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        #${CONTAINER_ID} .content-wrapper {
            flex-grow: 1;
            max-height: 250px;
            overflow-y: auto;
            padding-right: 15px;
        }
        #${CONTAINER_ID} h3 {
            margin: 0 0 10px 0;
            text-align: left;
            color: #cb4b16;
            font-size: 11px;
            text-transform: uppercase;
        }
        #${CONTAINER_ID} ul {
            list-style: none;
            padding-left: 0 !important;
            margin: 0;
        }
        #${CONTAINER_ID} li {
            padding: 4px 0;
            display: flex;
            align-items: center;
        }
        #${CONTAINER_ID} .diagnosis-name, #${CONTAINER_ID} .operation-name {
            margin-left: 8px;
        }
        #${CONTAINER_ID} .operation-code, #${CONTAINER_ID} .diagnosis-code {
            font-weight: bold;
            cursor: pointer;
            padding: 2px 5px;
            border-radius: 3px;
            background-color: #eee8d5;
            transition: background-color 0.2s;
            user-select: none;
        }
        #${CONTAINER_ID} .operation-code:hover, #${CONTAINER_ID} .diagnosis-code:hover {
            background-color: #e0dace;
        }
        #${CONTAINER_ID} button {
            width: auto;
            margin: 0 0 0 20px;
            padding: 6px 12px;
            font-size: 12px;
            background: #dc322f;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            flex-shrink: 0;
            align-self: center;
        }
        #evmias-pure-data-container {
            margin-top: 10px; padding-top: 10px; border-top: 1px dashed #b58900;
        }
        .pure-data-item {
            margin-bottom: 8px;

            line-height: 1.4;
        }
        .pure-data-item strong {
            display: block;
            color: #268bd2;
            margin-bottom: 3px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .pure-table-wrapper table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px !important;
        }
        .pure-table-wrapper th, .pure-table-wrapper td { border: 1px solid #ddd !important; padding: 5px !important; text-align: left; }
        .pure-table-wrapper th { background-color: #f9f9f9 !important; }

        .pure-data-item .diagnos-html-content {
            line-height: 1.4;
            padding: 8px;
            margin-top: 4px;
            border-left: 3px solid #eee8d5;
            background-color: #fdf6e3;
        }
        .pure-data-item .diagnos-html-content span {
           font-size: inherit !important;
           font-family: inherit !important;
           color: inherit !important;
        }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.id = STYLE_ID;
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    // --- 3. Создаем HTML-содержимое ---
    const container = document.createElement('div');
    container.id = CONTAINER_ID;

    container.innerHTML = `
        <div class="content-wrapper">
            <h3>${title}</h3>
            <div id="evmias-diagnoses-container"></div>
            <div id="evmias-operations-container" style="margin-top: 5px;"></div>
            <div id="evmias-pure-data-container"></div>
        </div>
        <button id="evmias-oms-close-btn">Закрыть</button>
    `;

    // --- Логика для диагнозов ---
    const diagnosesContainer = container.querySelector('#evmias-diagnoses-container');
    if (diagnoses && diagnoses.length > 0) {
        const listEl = document.createElement('ul');
        diagnoses.forEach(diag => { /* ... код создания списка диагнозов ... */
            const li = document.createElement('li');
            const codeSpan = document.createElement('span');
            codeSpan.className = 'diagnosis-code';
            codeSpan.textContent = diag.code;
            codeSpan.title = 'Нажмите, чтобы скопировать код';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'diagnosis-name';
            nameSpan.textContent = diag.name;
            codeSpan.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await navigator.clipboard.writeText(diag.code);
                    const originalText = codeSpan.textContent;
                    codeSpan.textContent = 'Скопировано!';
                    codeSpan.style.color = '#9b1b30';
                    setTimeout(() => {
                        codeSpan.textContent = originalText;
                        codeSpan.style.color = 'inherit';
                    }, 1500);
                } catch (err) {
                    console.error('Не удалось скопировать текст: ', err);
                }
            });
            li.appendChild(codeSpan);
            li.appendChild(nameSpan);
            listEl.appendChild(li);
        });
        diagnosesContainer.appendChild(listEl);
    }

    // --- Логика для операций  ---
    const operationsContainer = container.querySelector('#evmias-operations-container');
    if (operations && operations.length > 0) {
        const operationsListEl = document.createElement('ul');
        operations.forEach(op => { /* ... код создания списка операций ... */
            const li = document.createElement('li');
            const codeSpan = document.createElement('span');
            codeSpan.className = 'operation-code';
            codeSpan.textContent = op.code;
            codeSpan.title = 'Нажмите, чтобы скопировать код';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'operation-name';
            nameSpan.textContent = `${op.name}`;
            codeSpan.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await navigator.clipboard.writeText(op.code);
                    const originalText = codeSpan.textContent;
                    codeSpan.textContent = 'Скопировано!';
                    codeSpan.style.color = '#9b1b30';
                    setTimeout(() => {
                        codeSpan.textContent = originalText;
                        codeSpan.style.color = 'inherit';
                    }, 1500);
                } catch (err) {
                    console.error('Не удалось скопировать текст: ', err);
                }
            });
            li.appendChild(codeSpan);
            li.appendChild(nameSpan);
            operationsListEl.appendChild(li);
        });
        operationsContainer.appendChild(operationsListEl);
    }

    const pureContainer = container.querySelector('#evmias-pure-data-container');
    if (discharge && Object.values(discharge).some(v => v)) {
        let pureHtml = '';
        if (discharge.diagnos) {
            pureHtml += `
                <div class="pure-data-item">
                    <strong>Развернутый диагноз:</strong>
                    <div class="diagnos-html-content">${discharge.diagnos}</div>
                </div>`;
        }
        if (discharge.item_90) {
            pureHtml += `
                <div class="pure-data-item">
                    <strong>Основной диагноз:</strong>
                    <span>${discharge.item_90} — ${discharge.item_94 || ''}</span>
                </div>`;
        }
        if (discharge.item_272) {
            pureHtml += `<div class="pure-data-item"><strong>Клинический диагноз:</strong><span>${discharge.item_272}</span></div>`;
        }
        if (discharge.item_284) {
             pureHtml += `<div class="pure-data-item"><strong>Рекомендации:</strong><span>${discharge.item_284}</span></div>`;
        }
        if (discharge.item_659) {
            pureHtml += `
                <div class="pure-data-item">
                    <strong>Сопутствующие заболевания:</strong>
                    <div class="pure-table-wrapper">${discharge.item_659}</div>
                </div>`;
        }
        pureContainer.innerHTML = pureHtml;
    }

    // --- 5. Вставляем блок в начало body ---
    document.body.prepend(container);

    container.querySelector('#evmias-oms-close-btn').addEventListener('click', removeInjectedElements);
}


// --- Основная логика Content Script ---

if (window.self !== window.top) {
    console.log('✅ [Content Script] Запущен внутри iframe и готов получать сообщения.');

    // Слушаем сообщения от background.js
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'showFinalResultInPage') {
            console.log('[Content Script] Получены данные для отображения:', message.data);
            const { title, operations, diagnoses, discharge } = message.data;
            injectResultBlock(title, operations, diagnoses, discharge);
        }
    });

    let nativeCloseListenerAttached = false;
    const nativeButtonObserver = new MutationObserver(() => {
        if (nativeCloseListenerAttached) {
            return;
        }

        const allSpans = document.querySelectorAll('span.x-btn-inner');
        const closeSpan = Array.from(allSpans).find(span => span.textContent.trim() === 'Закрыть');

        if (closeSpan) {
            const closeButton = closeSpan.closest('button');
            if (closeButton) {
                console.log('[Content Script] Найдена нативная кнопка "Закрыть". Привязываем обработчик.');
                closeButton.addEventListener('click', removeInjectedElements);
                nativeCloseListenerAttached = true;
                nativeButtonObserver.disconnect();
            }
        }
    });

    // Начинаем наблюдение за изменениями в body iframe
    nativeButtonObserver.observe(document.body, { childList: true, subtree: true });
}

const TARGET_ELEMENT_SELECTOR = "input[name='ReferralHospitalizationNumberTicket']";
let isElementFound = false;

function checkElementAndNotify() {
    const element = document.querySelector(TARGET_ELEMENT_SELECTOR);
    const currentlyFound = !!element;
    if (currentlyFound !== isElementFound) {
        isElementFound = currentlyFound;
        chrome.runtime.sendMessage({ action: "updateIcon", found: isElementFound });
    }
}

const mainObserver = new MutationObserver(checkElementAndNotify);
mainObserver.observe(document.body, { childList: true, subtree: true });
checkElementAndNotify();