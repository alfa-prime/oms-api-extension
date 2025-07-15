/**
 * form.js
 * Инициализация формы:
 *  - установка стартовой и конечной даты (с начала прошлого месяца по сегодня)
 *  - фокус на поле «Фамилия»
 *  - установка последнего выбранного типа оплаты из хранилища
 */

/**
 * Загружает и устанавливает последнее выбранное значение для типа оплаты.
 * Добавляет слушатель для сохранения нового выбора.
 */
function initializePayTypeSelector() {
  const payTypeSelect = document.getElementById("payType");
  if (!payTypeSelect) return;

  // 1. Пытаемся загрузить последнее значение из локального хранилища расширения
  chrome.storage.local.get(["lastPayTypeId"], (result) => {
    if (result.lastPayTypeId) {
      console.log(
        `[Form.js] Загружен тип оплаты из хранилища: ${result.lastPayTypeId}`,
      );
      payTypeSelect.value = result.lastPayTypeId;
    } else {
      console.log(
        "[Form.js] Тип оплаты в хранилище не найден, используется значение по умолчанию.",
      );
    }
  });

  // 2. Добавляем слушатель, чтобы сохранять выбор пользователя немедленно
  payTypeSelect.addEventListener("change", (event) => {
    const newPayTypeId = event.target.value;
    chrome.storage.local.set({ lastPayTypeId: newPayTypeId }, () => {
      console.log(`[Form.js] Тип оплаты сохранен в хранилище: ${newPayTypeId}`);
    });
  });
}

export function initForm() {
  console.log("[Form.js] initForm вызвана"); // Добавим лог для проверки вызова
  const now = new Date();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Установка значений дат по умолчанию (начало прошлого месяца, сегодня)
  document.getElementById("startDate").value =
    prevMonthStart.toLocaleDateString("sv-SE");
  document.getElementById("endDate").value = now.toLocaleDateString("sv-SE");

  // Инициализация селектора типа оплаты (загрузка и сохранение)
  initializePayTypeSelector();

  // Фокус на поле "Фамилия" при открытии
  const lastnameInput = document.getElementById("lastname");
  if (lastnameInput) {
    lastnameInput.focus();
    lastnameInput.select();
  }
}
