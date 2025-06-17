// background.js

chrome.runtime.onInstalled.addListener(() => {
  console.log("Расширение запущено");
});

//chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//  if (message.action === "closePopup") {
//    chrome.windows.getAll({ populate: true, windowTypes: ["popup"] }, (windows) => {
//      for (const win of windows) {
//        if (
//          win.tabs.some(tab =>
//            tab.url && tab.url.includes("index.html")
//          )
//        ) {
//          chrome.windows.remove(win.id);
//          console.log("[background.js] Popup закрыт.");
//          break;
//        }
//      }
//    });
//  }
//});
