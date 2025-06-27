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
function injectResultBlock(title, operations, diagnoses) {
    removeInjectedElements();

    const styles = `
        #${CONTAINER_ID} {
            position: sticky;
            top: 0;
            left: 0;
            width: 100%;
            padding: 10px 15px;
            background-color: #fbe8a6;
            border: none;
            border-bottom: 2px solid #9b1b30;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            z-index: 99999;
            font-family: sans-serif;
            color: #333;
            border-radius: 0;
            box-sizing: border-box;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #${CONTAINER_ID} .content-wrapper {
            flex-grow: 1;
            max-height: 150px;
            overflow-y: auto;
        }
        #${CONTAINER_ID} h3 {
            margin: 0 0 5px 0;
            text-align: left;
            color: #9b1b30;
            font-size: 11px;
        }
        #${CONTAINER_ID} ul {
            list-style: none;
            padding-left: 0 !important;
            margin: 0;
        }
        #${CONTAINER_ID} li {
            font-size: 12px;
            padding: 3px 0;
            display: flex;
            align-items: center;
        }
        #${CONTAINER_ID} .diagnosis-name, #${CONTAINER_ID} .operation-name {
            margin-left: 5px;
        }
        #${CONTAINER_ID} .operation-code, #${CONTAINER_ID} .diagnosis-code {
            font-weight: bold;
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 3px;
            transition: background-color 0.2s;
            user-select: none;
        }
        #${CONTAINER_ID} .operation-code:hover, #${CONTAINER_ID} .diagnosis-code:hover {
            background-color: #e9e9e9;
        }
        #${CONTAINER_ID} button {
            width: auto;
            margin: 0 0 0 20px;
            padding: 6px 12px;
            font-size: 12px;
            background: #9b1b30;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            flex-shrink: 0;
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
            const { title, operations, diagnoses } = message.data;
            injectResultBlock(title, operations, diagnoses);
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