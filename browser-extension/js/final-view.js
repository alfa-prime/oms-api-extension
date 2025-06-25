document.addEventListener('DOMContentLoaded', () => {
    const titleEl = document.getElementById('final-view-title');
    const listEl = document.getElementById('operations-list');
    const closeBtn = document.getElementById('close-popup-btn');

    // Получаем параметры из URL
    const params = new URLSearchParams(window.location.search);
    const title = params.get('title') || 'Форма заполнена';
    const operationsParam = params.get('operations');

    titleEl.textContent = decodeURIComponent(title);

    // Если переданы операции, парсим их и отображаем
    if (operationsParam) {
        try {
            const operations = JSON.parse(decodeURIComponent(operationsParam));
            if (operations && operations.length > 0) {
                listEl.innerHTML = '';
                operations.forEach(op => {
                    const li = document.createElement('li');

                    // Создаем span для кода
                    const codeSpan = document.createElement('span');
                    codeSpan.className = 'operation-code';
                    codeSpan.textContent = op.code;
                    codeSpan.title = 'Нажмите, чтобы скопировать код'; // Всплывающая подсказка

                    // Создаем span для названия
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'operation-name';
                    nameSpan.textContent = `- ${op.name}`;

                    // Добавляем обработчик клика на код
                    codeSpan.addEventListener('click', async () => {
                        try {
                            await navigator.clipboard.writeText(op.code);
                            // Временно меняем текст, чтобы дать обратную связь
                            const originalText = codeSpan.textContent;
                            codeSpan.textContent = 'Скопировано!';
                            setTimeout(() => {
                                codeSpan.textContent = originalText;
                            }, 1500); // Возвращаем текст обратно через 1.5 секунды
                        } catch (err) {
                            console.error('Не удалось скопировать текст: ', err);
                            // Можно показать ошибку пользователю, если нужно
                            const originalText = codeSpan.textContent;
                            codeSpan.textContent = 'Ошибка!';
                            setTimeout(() => {
                                codeSpan.textContent = originalText;
                            }, 1500);
                        }
                    });

                    li.appendChild(codeSpan);
                    li.appendChild(nameSpan);
                    listEl.appendChild(li);
                });
            } else {
                listEl.style.display = 'none';
            }
        } catch (e) {
            console.error("Ошибка парсинга операций:", e);
            listEl.style.display = 'none';
        }
    } else {
        listEl.style.display = 'none';
    }

    // Кнопка "Закрыть" просто закрывает это окно
    closeBtn.addEventListener('click', () => {
        window.close();
    });
});