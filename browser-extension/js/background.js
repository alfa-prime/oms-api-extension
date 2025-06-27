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

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === 'updateIcon' && sender.tab) {
        await setActionState(sender.tab.id, message.found);
    }

    // Это сообщение теперь приходит от pageInjector.js
    if (message.action === 'showFinalResultInPage') {
        // ID вкладки теперь берется из "sender"
        if (sender.tab && sender.tab.id) {
            try {
                // Используем ID вкладки, откуда пришло сообщение
                await chrome.tabs.sendMessage(sender.tab.id, message);
                console.log(`[Background] Сообщение 'showFinalResultInPage' переслано на вкладку ${sender.tab.id}`);
            } catch (error) {
                console.error(`[Background] Ошибка пересылки сообщения на вкладку ${sender.tab.id}:`, error);
            }
        } else {
            console.error('[Background] Сообщение пришло не от вкладки, некуда пересылать.');
        }
    }

    // Сообщение об ошибке (тоже от pageInjector)
    if (message.action === 'injectionError') {
        console.error(`[Background] Ошибка от pageInjector на вкладке ${sender.tab.id}: ${message.error}`);
        // Здесь можно добавить логику уведомления пользователя, если нужно
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (!tab.url.startsWith("https://gisoms.ffoms.gov.ru/")) {
            await setActionState(tabId, false);
        }
    }
});