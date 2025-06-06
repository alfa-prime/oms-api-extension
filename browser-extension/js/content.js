// js/content.js

// Логируем, чтобы убедиться, что скрипт загрузился:
console.log("✅ content.js загружен (страница).");

// Подписываемся на сообщения из popup/main.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ожидаем запрос с action = "FETCH_LIST_MO"
  if (request.action === "FETCH_LIST_MO") {
    const url = `https://gisoms.ffoms.gov.ru/FFOMS/action/ReferralHospitalization/ListMo?_dc=${Date.now()}`;

    const bodyParams = new URLSearchParams({
      FilterByUserSubject: "true",
      page: "1",
      start: "0",
      limit: "50",
      records: "[]",
    }).toString();

    // Делаем fetch в контексте страницы (будут приложены куки)
    fetch(url, {
      method: "POST",
      headers: {
        Accept: "*/*",
        // "b4-workspace-id": "ed7b548d-2646-419c-b93a-3c7567cbb49b",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      referrer: "https://gisoms.ffoms.gov.ru/FOMS/ffoms/",
      referrerPolicy: "strict-origin-when-cross-origin",
      credentials: "include", // чтобы передать cookie
      body: bodyParams,
    })
      .then((response) => {
        if (response.status === 404) {
          console.warn("ListMo вернул 404 (тех. работы).");
          sendResponse({ success: false, status: 404, data: null });
          return null; // Важно, чтобы следующий .then не пытался парсить JSON
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then((jsonData) => {
        if (jsonData !== null) {
          sendResponse({ success: true, status: 200, data: jsonData });
        }
      })
      .catch((err) => {
        console.error("Ошибка при fetchListMo в content.js:", err);
        sendResponse({
          success: false,
          status: err.message || "Network error",
          data: null,
        });
      });

    return true;
  }
});
