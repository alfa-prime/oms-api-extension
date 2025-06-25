// browser-extension/js/content.js

// Уникальные ID для наших элементов, чтобы избежать конфликтов
const CONTAINER_ID = 'evmias-oms-result-container';
const STYLE_ID = 'evmias-oms-result-styles';

/**
 * Функция для создания и вставки блока с результатами.
 * @param {string} title - Заголовок блока.
 ** @param {Array<object>} operations - Массив с данными об операциях.
 */
function injectResultBlock(title, operations) {
    // --- 1. Удаляем старый блок, если он есть ---
    const oldContainer = document.getElementById(CONTAINER_ID);
    if (oldContainer) {
        oldContainer.remove();
    }
    const oldStyle = document.getElementById(STYLE_ID);
    if (oldStyle) {
        oldStyle.remove();
    }

    // --- 2. Создаем CSS-стили ---
    // Вставляем стили прямо в тег <style>, чтобы они были изолированы
    const styles = `
        #${CONTAINER_ID} {
            position: sticky;
            top: 0;
            left: 0;
            width: 100%;
            padding: 10px 15px; /* Уменьшаем вертикальный padding */
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
        }
        #${CONTAINER_ID} h3 {
            margin: 0;
            text-align: left;
            color: #9b1b30;
            font-size: 11px; /* Уменьшаем шрифт заголовка */
        }
        #${CONTAINER_ID} ul {
            list-style: none;
            padding: 0;
            margin: 4px 0 0 0;
            max-height: 100px; /* Уменьшаем высоту скролла */
            overflow-y: auto;
        }
        #${CONTAINER_ID} li {
            font-size: 12px; /* Уменьшаем шрифт списка */
            padding: 3px 0;
            border-bottom: 1px dotted #ccc;
            display: flex;
            align-items: center;
        }
        #${CONTAINER_ID} li:last-child {
            border-bottom: none;
        }
        /* Стили для кликабельного кода операции */
        #${CONTAINER_ID} .operation-code {
            font-weight: bold;
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 3px;
            transition: background-color 0.2s;
            user-select: none; /* Чтобы текст не выделялся при клике */
        }
        #${CONTAINER_ID} .operation-code:hover {
            background-color: #e9e9e9;
        }
        #${CONTAINER_ID} .operation-name {
             margin-left: 5px;
        }
        #${CONTAINER_ID} button {
            width: auto;
            margin: 0 0 0 20px;
            padding: 6px 12px; /* Уменьшаем кнопку */
            font-size: 12px; /* Уменьшаем шрифт кнопки */
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

    // Оборачиваем контент и кнопку в div-ы для flexbox
    container.innerHTML = `
        <div class="content-wrapper">
            <h3>${title}</h3>
            <ul id="evmias-operations-list-in-page"></ul>
        </div>
        <button id="evmias-oms-close-btn">Закрыть</button>
    `;

    // --- 4. Заполняем список операций, если они есть, и добавляем логику копирования ---
    if (operations && operations.length > 0) {
        const operationsListEl = container.querySelector('#evmias-operations-list-in-page');
        operations.forEach(op => {
            const li = document.createElement('li');

            const codeSpan = document.createElement('span');
            codeSpan.className = 'operation-code';
            codeSpan.textContent = op.code;
            codeSpan.title = 'Нажмите, чтобы скопировать код';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'operation-name';
            nameSpan.textContent = `${op.name}`;

            codeSpan.addEventListener('click', async (e) => {
                e.stopPropagation(); // Предотвращаем всплытие события
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
    } else {
        // Если операций нет, скрываем пустой список
        const operationsListEl = container.querySelector('#evmias-operations-list-in-page');
        if (operationsListEl) operationsListEl.style.display = 'none';
    }


    // --- 5. Вставляем блок в начало body ---
    document.body.prepend(container);

    // --- 6. Добавляем обработчик на кнопку "Закрыть" ---
    container.querySelector('#evmias-oms-close-btn').addEventListener('click', () => {
        container.remove();
        styleSheet.remove(); // Удаляем и стили
    });
}


// --- Основная логика Content Script ---

// Этот скрипт выполняется только внутри iframe
if (window.self !== window.top) {
    console.log('✅ [Content Script] Запущен внутри iframe и готов получать сообщения.');

    // Слушаем сообщения от background.js
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'showFinalResultInPage') {
            console.log('[Content Script] Получены данные для отображения:', message.data);
            const { title, operations } = message.data;
            injectResultBlock(title, operations);
        }
    });
}

// Старая логика для активации иконки (оставляем, она не мешает)
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

const observer = new MutationObserver(checkElementAndNotify);
observer.observe(document.body, { childList: true, subtree: true });
checkElementAndNotify();