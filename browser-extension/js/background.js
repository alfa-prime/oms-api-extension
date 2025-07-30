// browser-extension/js/background.js
import { injectionTargetFunction } from './pageInjector.js';

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
    // Этот слушатель остается для обновления иконки
    if (message.action === 'updateIcon' && sender.tab) {
        await setActionState(sender.tab.id, message.found);
        return;
    }

    // НОВЫЙ СЛУШАТЕЛЬ для фонового заполнения формы
    if (message.action === 'startFormFill') {
        // === ИЗМЕНЕНИЕ ЗДЕСЬ ===
        // Надежно получаем текущую активную вкладку. Не используем `sender.tab`.
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Проверяем, что вкладка нашлась
        if (!tab || !tab.id) {
            console.error('[Background] Не удалось найти активную вкладку для инъекции скрипта.');
            return;
        }

        console.log(`[Background] Получены данные для автозаполнения на вкладке ${tab.id}. Запускаем инъекцию...`);

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id }, // Используем ID найденной вкладки
                func: injectionTargetFunction,
                args: [message.data]
            });
            console.log(`[Background] Инъекция скрипта на вкладку ${tab.id} успешно запущена.`);
        } catch (error) {
            console.error(`[Background] Ошибка при инъекции скрипта на вкладку ${tab.id}:`, error);
        }
        return;
    }

    // Этот слушатель остается для отображения доп. данных (операции/диагнозы)
    if (message.action === 'showFinalResultInPage') {
        if (sender.tab && sender.tab.id) {
            try {
                await chrome.tabs.sendMessage(sender.tab.id, message);
                console.log(`[Background] Сообщение 'showFinalResultInPage' переслано на вкладку ${sender.tab.id}`);
            } catch (error) {
                console.error(`[Background] Ошибка пересылки сообщения на вкладку ${sender.tab.id}:`, error);
            }
        } else {
            console.error('[Background] Сообщение пришло не от вкладки, некуда пересылать.');
        }
        return;
    }

    // Этот слушатель остается для ошибок
    if (message.action === 'injectionError') {
        console.error(`[Background] Ошибка от pageInjector: ${message.error}`);
        return;
    }

    if (message.action === 'formFillError') {
        chrome.notifications.create({
            type: 'progress',
            iconUrl: chrome.runtime.getURL('images/icon.png'),
            title: 'ЕВМИАС -> ОМС: Ошибка!',
            message: `Заполнение формы прервано ошибкой: ${message.error}`,
            progress: 100,
            priority: 2
        });
        return;
    }

    if (message.action === 'formFillComplete') {
        const patientInfo = message.patientName ? `для пациента ${message.patientName}` : '';
        console.log('[Background] Получено сообщение formFillComplete. Создаем уведомление...');
        chrome.notifications.create({
            type: 'progress',
            iconUrl: chrome.runtime.getURL('images/icon.png'),
            title: 'ЕВМИАС -> ОМС',
            message: `Заполнение формы успешно завершено ${patientInfo}.`,
            progress: 100,
            priority: 2
        });
        return;
    }


});


chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (!tab.url.startsWith("https://gisoms.ffoms.gov.ru/")) {
            await setActionState(tabId, false);
        }
    }
});