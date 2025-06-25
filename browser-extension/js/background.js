// browser-extension/js/background.js

const TITLE_ENABLED = 'ЕВМИАС -> ОМС: Заполнить форму';
const TITLE_DISABLED = 'ЕВМИАС -> ОМС (неактивно)';
const REASON_DISABLED = 'Перейдите на страницу ввода данных в ГИС ОМС для активации.';

async function setActionState(tabId, enabled) {
    if (enabled) {
        await chrome.action.enable(tabId);
        await chrome.action.setTitle({ tabId: tabId, title: TITLE_ENABLED });
    } else {
        await chrome.action.disable(tabId);
        await chrome.action.setTitle({ tabId: tabId, title: `${TITLE_DISABLED}\n${REASON_DISABLED}` });
    }
}

// Делаем сам обработчик АСИНХРОННЫМ
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === 'updateIcon' && sender.tab) {
        console.log(`[Background] Получено сообщение от вкладки ${sender.tab.id}: элемент ${message.found ? 'найден' : 'не найден'}.`);
        await setActionState(sender.tab.id, message.found);
    }

    // Сообщение на создание окна теперь просто создает окно, без "липкости"
    if (message.action === 'createStickyWindow') {
        console.log('[Background] Получено сообщение на создание окна', message.options);
        const { url, width, height, left, top } = message.options;
        try {
            // Просто создаем окно. Без сохранения ID и без лишней логики.
            await chrome.windows.create({
                url, type: 'popup', width, height, left, top, focused: true
            });
            console.log('[Background] Окно создано успешно.');
        } catch (error) {
            console.error('[Background] Ошибка при создании окна:', error);
        }
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (!tab.url.startsWith("https://gisoms.ffoms.gov.ru/")) {
            console.log(`[Background] Пользователь ушел с домена ГИС ОМС. Принудительное отключение иконки для вкладки ${tabId}.`);
            await setActionState(tabId, false);
        }
    }
});

// --- ЛОГИКА "ALWAYS-ON-TOP" ПОЛНОСТЬЮ УДАЛЕНА ---
// Обработчики onFocusChanged и onRemoved больше не нужны.