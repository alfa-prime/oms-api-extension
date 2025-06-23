// browser-extension/js/content.js

if (window.self === window.top) {
    console.log('[Content Script] Запущен в основном документе. Ничего не делаем здесь.');
} else {
    console.log('✅ [Content Script] Запущен внутри iframe и следит за DOM...');

    // --- Конфигурация ---
    // Селектор для конкретного инпута на форме
    const TARGET_ELEMENT_SELECTOR = "input[name='ReferralHospitalizationNumberTicket']";
    let isElementFound = false; // Храним текущее состояние

    /**
     * Проверяет наличие элемента на странице и отправляет сообщение в background.js,
     * если состояние изменилось.
     */
    function checkElementAndNotify() {
        // Ищем элемент только в текущем документе (внутри этого iframe)
        const element = document.querySelector(TARGET_ELEMENT_SELECTOR);
        const currentlyFound = !!element;

        if (currentlyFound !== isElementFound) {
            isElementFound = currentlyFound;
            console.log(`[Content Script] Элемент "${TARGET_ELEMENT_SELECTOR}" ${isElementFound ? 'НАЙДЕН' : 'НЕ НАЙДЕН'}. Отправка сообщения...`);
            chrome.runtime.sendMessage({ action: "updateIcon", found: isElementFound });
        }
    }

    // --- Наблюдатель за изменениями в DOM ---
    const observer = new MutationObserver(() => {
        checkElementAndNotify();
    });

    // Наблюдаем за изменениями в теле документа этого фрейма
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Первоначальная проверка при загрузке скрипта
    checkElementAndNotify();
}
