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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateIcon' && sender.tab) {
        console.log(`[Background] Получено сообщение от вкладки ${sender.tab.id}: элемент ${message.found ? 'найден' : 'не найден'}.`);
        setActionState(sender.tab.id, message.found);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (!tab.url.startsWith("https://gisoms.ffoms.gov.ru/")) {
            console.log(`[Background] Пользователь ушел с домена ГИС ОМС. Принудительное отключение иконки для вкладки ${tabId}.`);
            setActionState(tabId, false);
        }
    }
});