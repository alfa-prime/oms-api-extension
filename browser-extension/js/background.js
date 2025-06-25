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

    // Пересылаем сообщение от popup в content script активной вкладки
    if (message.action === 'showFinalResultInPage') {
        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            if (tab) {
                // Отправляем сообщение именно в эту вкладку
                await chrome.tabs.sendMessage(tab.id, message);
                console.log(`[Background] Сообщение 'showFinalResultInPage' переслано на вкладку ${tab.id}`);
            }
        } catch (error) {
            console.error('[Background] Ошибка пересылки сообщения:', error);
        }
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (!tab.url.startsWith("https://gisoms.ffoms.gov.ru/")) {
            await setActionState(tabId, false);
        }
    }
});