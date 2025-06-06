/**
 * utils.js
 * Утилиты:
 *  - debounce: предотвращает слишком частые вызовы
 *  - showMessage: показывает информационное сообщение / прячет прелоадер
 *  - showError: обёртка для отображения ошибки
 */

// Debounce-функция: предотвращает частые вызовы (например, при быстрой печати и нажатии Enter)
export function debounce(fn, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Показать сообщение на экране (info или error)
export function showMessage(msg, type = "info") {
  const messageEl = document.getElementById("message");
  messageEl.textContent = msg;
  messageEl.className = `message ${type}`;
  messageEl.style.display = "block";

  // Скрыть прелоадер и вернуть кнопку к обычному состоянию
  document.getElementById("loading").style.display = "none";
  const btn = document.getElementById("searchBtn");
  btn.disabled = false;
  btn.textContent = "Искать";
}

// Обёртка для отображения ошибки
export function showError(msg) {
  showMessage(msg, "error");
}
