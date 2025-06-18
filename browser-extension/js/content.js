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

// Подписываемся на сообщения из popup/main.js
//chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//  // Ожидаем запрос с action = "FETCH_LIST_MO"
//  if (request.action === "FETCH_LIST_MO") {
//    const url = `https://gisoms.ffoms.gov.ru/FFOMS/action/ReferralHospitalization/ListMo?_dc=${Date.now()}`;
//
//    const bodyParams = new URLSearchParams({
//      FilterByUserSubject: "true",
//      page: "1",
//      start: "0",
//      limit: "50",
//      records: "[]",
//    }).toString();
//
//    // Делаем fetch в контексте страницы (будут приложены куки)
//    fetch(url, {
//      method: "POST",
//      headers: {
//        Accept: "*/*",
//        // "b4-workspace-id": "ed7b548d-2646-419c-b93a-3c7567cbb49b",
//        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
//        "X-Requested-With": "XMLHttpRequest",
//      },
//      referrer: "https://gisoms.ffoms.gov.ru/FOMS/ffoms/",
//      referrerPolicy: "strict-origin-when-cross-origin",
//      credentials: "include", // чтобы передать cookie
//      body: bodyParams,
//    })
//      .then((response) => {
//        if (response.status === 404) {
//          console.warn("ListMo вернул 404 (тех. работы).");
//          sendResponse({ success: false, status: 404, data: null });
//          return null; // Важно, чтобы следующий .then не пытался парсить JSON
//        }
//        if (!response.ok) {
//          throw new Error(`HTTP ${response.status} ${response.statusText}`);
//        }
//        return response.json();
//      })
//      .then((jsonData) => {
//        if (jsonData !== null) {
//          sendResponse({ success: true, status: 200, data: jsonData });
//        }
//      })
//      .catch((err) => {
//        console.error("Ошибка при fetchListMo в content.js:", err);
//        sendResponse({
//          success: false,
//          status: err.message || "Network error",
//          data: null,
//        });
//      });
//
//    return true;
//  }
//});
