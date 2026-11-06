// Сценарии e2e. Каждый получает { page, url, specText, browser, apiState, check }.
const loadSpec = async (page, specText) => {
  await page.locator('#spec-text').fill(specText);
  await page.getByRole('button', { name: 'Загрузить спецификацию' }).click();
};


// --- помощники для конструктора ---
const editorField = (page, label) =>
  page.locator('.element-editor .field').filter({ has: page.locator(`label:text-is("${label}")`) }).first();
const addElement = async (page, type) => {
  await page.locator('.element-list-add select').selectOption(type);
  await page.locator('.element-list-add button').click();
};
const openBuilder = (page) => page.getByRole('button', { name: 'Конструктор' }).click();

// --- помощники для общего словаря / сервера ---
const synced = (page) => page.waitForFunction(() => document.querySelector('[data-sync]')?.dataset.sync === 'synced', null, { timeout: 8000 });
const serverDict = (page) => page.evaluate(() => fetch('/api/dictionary').then((r) => r.json()));
const openDict = (page) => page.getByRole('button', { name: 'Словарь' }).click();
const addEntry = async (page, key, ru, en) => {
  const inputs = page.locator('.dictionary-add input');
  await inputs.nth(0).fill(key); await inputs.nth(1).fill(ru); await inputs.nth(2).fill(en);
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
};
const newPage = async (browser, url) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  return { context, page };
};

// Сценарии, где сетевые ошибки в консоли браузера ожидаемы (сервер «упал» или отклонил запрос)
export const expectNetworkErrors = new Set(['Сервер: офлайн-режим и повторная отправка', 'Сервер: некорректную спецификацию отклоняет', 'Сервер недоступен: сохранение формы сообщает об ошибке']);

export default {
  async 'JSON → форма'({ page, specText, check }) {
    await loadSpec(page, specText);
    check('форма отрисована (поле «Имя пользователя»)', await page.getByText('Имя пользователя').count() > 0);
    check('заголовок формы «Пример формы»', await page.locator('h2').innerText() === 'Пример формы');
  },

  async 'скрытое поле сохраняет значение'({ page, specText, check }) {
    await loadSpec(page, specText);
    check('comment скрыт при hasComment=false', await page.locator('textarea').count() === 1); // только textarea спецификации
    await page.getByLabel('Добавить комментарий?').check();
    const ta = page.locator('.form-renderer textarea');
    check('после включения comment виден с дефолтом', (await ta.inputValue()) === 'Комментарий по умолчанию');
    await ta.fill('мой текст');
    await page.getByLabel('Добавить комментарий?').uncheck();
    await page.getByLabel('Добавить комментарий?').check();
    check('введённый текст пережил скрытие/показ', (await page.locator('.form-renderer textarea').inputValue()) === 'мой текст');
  },

  async 'переключение EN: кнопки и подписи'({ page, specText, check }) {
    await loadSpec(page, specText);
    await page.getByRole('button', { name: 'EN' }).click();
    const body = await page.locator('.app').innerText();
    check('кнопка «+ Add row»', body.includes('+ Add row'));
    check('кнопка «+ Add»', body.includes('+ Add'));
    check('Collect data', body.includes('Collect data'));
    check('вкладка Builder', body.includes('Builder'));
    check('в форме нет русских подписей', !/Имя пользователя|Добавить комментарий|Ширина/.test(await page.locator('.form-renderer').innerText()));
  },

  async 'Конструктор: «Показывать по условию»'({ page, check }) {
    await page.getByRole('button', { name: 'Конструктор' }).click();
    const addSelect = page.locator('.element-list-add select');
    await addSelect.selectOption('checkbox'); await page.locator('.element-list-add button').click();
    await addSelect.selectOption('text'); await page.locator('.element-list-add button').click();
    check('в списке два элемента', await page.locator('.element-row').count() === 2);
    const box = page.getByLabel('Показывать по условию');
    await box.check();
    check('галочка осталась включённой', await box.isChecked());
    check('появился редактор условия', await page.locator('.condition-editor').count() === 1);
    check('в превью сейчас виден только чекбокс (текстовое поле скрыто условием)', await page.locator('.form-renderer .field').count() === 1);
    await page.locator('.form-renderer input[type=checkbox]').check();
    check('после включения чекбокса в превью появилось второе поле', await page.locator('.form-renderer .field').count() === 2);
    await box.uncheck();
    check('снятие галочки убирает редактор условия', await page.locator('.condition-editor').count() === 0);
  },

  async 'Словарь: добавить, сохранить, перезагрузить'({ page, specText, check }) {
    await page.getByRole('button', { name: 'Словарь' }).click();
    const inputs = page.locator('.dictionary-add input');
    await inputs.nth(0).fill('save_btn'); await inputs.nth(1).fill('Сохранить'); await inputs.nth(2).fill('Save');
    await page.getByRole('button', { name: 'Добавить', exact: true }).click();
    check('ключ появился в таблице', await page.locator('.dictionary-table code', { hasText: 'save_btn' }).count() === 1);
    await inputs.nth(0).fill('bad key');
    await inputs.nth(1).fill('x');
    await page.getByRole('button', { name: 'Добавить', exact: true }).click();
    check('некорректный ключ отклонён с сообщением', await page.locator('.dictionary-error').count() === 1);
    await page.reload();
    await page.getByRole('button', { name: 'Словарь' }).click();
    check('после перезагрузки запись сохранилась (localStorage)', await page.locator('.dictionary-table code', { hasText: 'save_btn' }).count() === 1);
    await page.getByRole('button', { name: 'Удалить' }).first().click();
    check('удаление работает', await page.locator('.dictionary-table').count() === 0);
  },

  async 'Словарь: ru — нет ложного «нет перевода»'({ page, specText, check }) {
    await loadSpec(page, specText);
    await page.getByRole('button', { name: 'Словарь' }).click();
    const t = await page.locator('.dictionary-panel').innerText();
    check('на RU нет сообщения «Нет перевода»', !t.includes('Нет перевода'));
    await page.getByRole('button', { name: 'EN' }).click();
    check('на EN форма полностью переведена', (await page.locator('.dictionary-panel').innerText()).includes('All keys of the current form are translated'));
  },

  async 'Конструктор: общие свойства попадают в форму'({ page, check }) {
    await openBuilder(page); await addElement(page, 'text');
    await editorField(page, 'Описание (description)').locator('input').fill('Подсказка автору');
    await editorField(page, 'Подсказка в поле (placeholder)').locator('input').fill('введите');
    await editorField(page, 'Значение по умолчанию (default)').locator('input').fill('abc');
    const input = page.locator('.form-renderer input[type=text]');
    check('default попал в форму', (await input.inputValue()) === 'abc');
    check('placeholder попал в форму', (await input.getAttribute('placeholder')) === 'введите');
    check('description показан как подсказка', (await page.locator('.form-renderer .field-hint').innerText()) === 'Подсказка автору');
    await page.getByLabel('Заблокировано').check();
    check('«Заблокировано» → поле disabled', await input.isDisabled());
    await page.getByLabel('Скрытое').check();
    check('«Скрытое» → поля нет в форме', await page.locator('.form-renderer .field').count() === 0);
  },

  async 'Конструктор: поле без смысла для типа не показывается'({ page, check }) {
    await openBuilder(page); await addElement(page, 'select');
    check('у select нет placeholder', await page.locator('.element-editor label:text-is("Подсказка в поле (placeholder)")').count() === 0);
    check('у select есть редактор вариантов', await page.locator('.options-editor').count() === 1);
    await addElement(page, 'array');
    check('у array нет default', await page.locator('.element-editor label:text-is("Значение по умолчанию (default)")').count() === 0);
    check('у array нет «Заблокировано»', await page.getByLabel('Заблокировано').count() === 0);
  },

  async 'Конструктор: computed — фишки и проверка'({ page, check }) {
    await openBuilder(page);
    await addElement(page, 'number'); await addElement(page, 'number'); await addElement(page, 'number');
    // выбран number_3
    const chips = page.locator('.computed-chips .chip');
    await page.locator('.computed-chips .chip', { hasText: /^number_1$/ }).click();
    await page.locator('.computed-chips .chip', { hasText: /^\*$/ }).click();
    await page.locator('.computed-chips .chip', { hasText: /^number_2$/ }).click();
    check('выражение собрано кликами', (await page.locator('.computed-editor input').inputValue()) === 'number_1 * number_2');
    const nums = page.locator('.form-renderer input[type=number]');
    await nums.nth(0).fill('3'); await nums.nth(1).fill('4');
    check('в форме number_3 = 12', (await nums.nth(2).inputValue()) === '12');
    await page.locator('.computed-editor input').fill('zzz * 2');
    check('неизвестное поле → сразу сообщение', (await page.locator('.computed-editor .field-error').innerText()).includes('zzz'));
    await page.locator('.computed-editor input').fill('number_1 *');
    check('синтаксическая ошибка → сообщение', (await page.locator('.computed-editor .field-error').count()) === 1);
  },

  async 'Конструктор: цикл создать нельзя'({ page, check }) {
    await openBuilder(page);
    await addElement(page, 'number'); await addElement(page, 'number');   // number_1, number_2 (выбран number_2)
    await page.locator('.computed-chips .chip', { hasText: /^number_1$/ }).click(); // number_2 = number_1
    await page.locator('.element-row-title').nth(0).click();                // выбираем number_1
    const chipNames = await page.locator('.computed-chips .chip:not(.chip-op)').allInnerTexts();
    check('у number_1 среди кандидатов нет number_2 (зависит от него)', !chipNames.includes('number_2'));
    check('«Показывать по условию» у number_1 заблокировано: не от чего зависеть', await page.getByLabel('Показывать по условию').isDisabled());
    check('ошибок цикла в списке нет', (await page.locator('.error-list').count()) === 0);
  },

  async 'Конструктор: optionsSource — только массивы'({ page, check }) {
    await openBuilder(page);
    await addElement(page, 'number'); await addElement(page, 'array'); await addElement(page, 'select');
    const dd = editorField(page, 'Источник вариантов из другого поля (bind.optionsSource)').locator('select');
    const opts = await dd.locator('option').allInnerTexts();
    check('в списке источников только «не использовать» и массив', opts.length === 2 && opts[0].includes('не использовать'));
    await dd.selectOption({ index: 1 });
    check('после выбора источника варианты у select не нужны — пока пусто', await page.locator('.form-renderer select option:not([disabled])').count() === 0);
    await page.locator('.form-renderer .array-row-input').count();
    await page.locator('.form-renderer button', { hasText: '+ Добавить' }).click();
    await page.locator('.form-renderer .array-row-input input').fill('x');
    const names = await page.locator('.form-renderer select option:not([disabled])').allInnerTexts();
    check('значения массива стали вариантами select', names.join() === 'x');
  },

  async 'Конструктор: порядок вариантов select'({ page, check }) {
    await openBuilder(page); await addElement(page, 'select');
    await page.getByRole('button', { name: '+ Вариант' }).click();
    const rows = page.locator('.options-editor-row');
    await rows.nth(0).locator('input[placeholder=label]').fill('Первый');
    await rows.nth(1).locator('input[placeholder=label]').fill('Второй');
    check('до перестановки: Первый, Второй', (await page.locator('.form-renderer select option:not([disabled])').allInnerTexts()).join() === 'Первый,Второй');
    await rows.nth(0).getByRole('button', { name: 'Ниже' }).click();
    check('после «Ниже»: Второй, Первый', (await page.locator('.form-renderer select option:not([disabled])').allInnerTexts()).join() === 'Второй,Первый');
    check('у первой строки «Выше» заблокирована', await page.locator('.options-editor-row').nth(0).getByRole('button', { name: 'Выше' }).isDisabled());
    await page.getByRole('button', { name: '+ Вариант' }).click();
    const values = await page.locator('.options-editor-row input[placeholder=value]').evaluateAll((els) => els.map((e) => e.value));
    check('значения вариантов уникальны', new Set(values).size === values.length);
  },

  async 'Начальная видимость: условие от пустого select'({ page, check }) {
    const spec = { title: 'T', elements: [
      { name: 'kind', label: 'Тип', type: 'select', options: [{ value: 'a', label: 'A' }, { value: 'other', label: 'Другое' }] },
      { name: 'comment', label: 'Комментарий', type: 'text', bind: { visibleWhen: 'kind == "other"' } } ] };
    await page.locator('#spec-text').fill(JSON.stringify(spec));
    await page.getByRole('button', { name: 'Загрузить спецификацию' }).click();
    check('комментарий скрыт, пока тип не выбран', await page.locator('.form-renderer').getByText('Комментарий').count() === 0);
    await page.locator('.form-renderer select').selectOption('other');
    check('после выбора «Другое» комментарий появился', await page.locator('.form-renderer').getByText('Комментарий').count() === 1);
  },

  async 'Ключи переводов: подсказка из словаря и перевод в форме'({ page, check }) {
    await page.getByRole('button', { name: 'Словарь' }).click();
    const inputs = page.locator('.dictionary-add input');
    await inputs.nth(0).fill('my_key'); await inputs.nth(1).fill('Моя подпись'); await inputs.nth(2).fill('My label');
    await page.getByRole('button', { name: 'Добавить', exact: true }).click();
    await openBuilder(page); await addElement(page, 'text');
    check('ключ словаря есть в подсказках labelKey', await page.locator('#dictionary-keys option[value=my_key]').count() === 1);
    await page.locator('.translation-keys summary').click();
    await page.locator('.translation-keys input').first().fill('my_key');
    await page.getByRole('button', { name: 'EN' }).click();
    check('в EN-форме подпись взята из общего словаря', (await page.locator('.form-renderer').innerText()).includes('My label'));
  },

  async 'Граф зависимостей'({ page, check }) {
    await openBuilder(page);
    check('пока связей нет — подсказка', (await page.locator('.dependency-view').innerText()).includes('Связей между полями пока нет'));
    await addElement(page, 'checkbox'); await addElement(page, 'text');
    await page.getByLabel('Показывать по условию').check();
    const rows = page.locator('.dep-row');
    check('появилась одна связь', await rows.count() === 1);
    const txt = await rows.first().innerText();
    check('связь «checkbox_1 → видимость → text_1»', /checkbox_1/.test(txt) && /видимость/.test(txt) && /text_1/.test(txt));
    check('счётчик в заголовке = 1', (await page.locator('.dependency-view h3').innerText()).includes('(1)'));
    await rows.first().locator('.dep-chip').first().click();
    check('клик по источнику выбирает его в списке', (await page.locator('.element-row.selected .element-row-summary').innerText()).includes('checkbox_1'));
  },

  async 'Режим «Предпросмотр»'({ page, specText, check }) {
    await loadSpec(page, specText);
    await page.getByRole('button', { name: 'Предпросмотр' }).click();
    check('редактор JSON скрыт', await page.locator('#spec-text').count() === 0);
    check('форма видна', await page.locator('.form-renderer').count() === 1);
    check('раскладка в одну колонку', await page.locator('.app-columns.preview-only').count() === 1);
    await page.getByLabel('Добавить комментарий?').check();
    check('форма в предпросмотре работает (комментарий появился)', await page.locator('.form-renderer textarea').count() === 1);
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    check('возврат в JSON — текст на месте', (await page.locator('#spec-text').inputValue()).includes('"hasComment"'));
  },

  async 'JSON: копировать и скачать'({ page, specText, check }) {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await loadSpec(page, specText);
    await page.getByRole('button', { name: 'Копировать JSON' }).click();
    check('сообщение «Скопировано»', (await page.locator('.json-tools-message').innerText()) === 'Скопировано');
    check('в буфере — текст спецификации', (await page.evaluate(() => navigator.clipboard.readText())) === specText);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Скачать JSON' }).click()]);
    check(`имя файла из названия формы (получено: ${download.suggestedFilename()})`, download.suggestedFilename() === 'Primer_formy.json');
    const { readFileSync } = await import('node:fs');
    check('содержимое скачанного файла = JSON', readFileSync(await download.path(), 'utf8') === specText);
  },

  async 'Импорт JSON в конструктор'({ page, specText, check }) {
    await openBuilder(page);
    const input = page.locator('.json-tools input[type=file]');
    await input.setInputFiles({ name: 'spec.json', mimeType: 'application/json', buffer: Buffer.from(specText) });
    await page.locator('.element-row').first().waitFor();
    check('все 9 элементов загружены в конструктор', await page.locator('.element-row').count() === 9);
    check('форма в превью построена', await page.locator('.form-renderer').getByText('Имя пользователя').count() === 1);
    check('ошибок нет', await page.locator('.error-list').count() === 0);
    check('граф зависимостей заполнен (comment←hasComment, area←width,height)', await page.locator('.dep-row').count() === 3);

    await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"foo": 1}') });
    await page.locator('.json-tools-message').waitFor();
    check('не-спецификация отклонена с сообщением', (await page.locator('.json-tools-message').innerText()).includes('не JSON-спецификация'));
    check('конструктор не потерял прежнее содержимое', await page.locator('.element-row').count() === 9);

    const withErrors = { title: 'T', elements: [{ name: 'a', label: 'A', type: 'text' }, { name: 'a', label: 'B', type: 'text' }] };
    await input.setInputFiles({ name: 'err.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(withErrors)) });
    await page.locator('.error-list').waitFor();
    check('спецификация с ошибками загружена и ошибки показаны', (await page.locator('.error-list').innerText()).includes('уже используется'));
    check('в списке элемента есть значок ошибки', await page.locator('.element-row-error-badge').count() >= 1);
  },

  async 'Цикл: собрал в конструкторе → скачал → загрузил обратно'({ page, check }) {
    await openBuilder(page);
    await addElement(page, 'checkbox'); await addElement(page, 'text');
    await page.getByLabel('Показывать по условию').check();
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    const before = await page.locator('#spec-text').inputValue();
    check('в JSON попал visibleWhen', JSON.parse(before).elements[1].bind.visibleWhen === 'checkbox_1 == true');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Скачать JSON' }).click()]);
    const { readFileSync } = await import('node:fs');
    const file = readFileSync(await download.path());
    await page.reload();
    await openBuilder(page);
    await page.locator('.json-tools input[type=file]').setInputFiles({ name: 'form.json', mimeType: 'application/json', buffer: file });
    await page.locator('.element-row').first().waitFor();
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    check('после перезагрузки и импорта JSON тот же', (await page.locator('#spec-text').inputValue()) === before);
  },
  async 'Сервер: словарь сохраняется на сервере'({ page, check }) {
    await openDict(page);
    await synced(page);
    await addEntry(page, 'srv_key', 'Сервер', 'Server');
    await synced(page);
    const d = await serverDict(page);
    check('запись есть на сервере (ru и en)', d.ru.srv_key === 'Сервер' && d.en.srv_key === 'Server');
    await page.locator('.dictionary-table tr', { hasText: 'srv_key' }).locator('input').nth(1).fill('Server!');
    await synced(page);
    check('правка перевода дошла до сервера', (await serverDict(page)).en.srv_key === 'Server!');
    await page.getByRole('button', { name: 'Удалить' }).first().click();
    await synced(page);
    check('удаление дошло до сервера', (await serverDict(page)).ru.srv_key === undefined);
  },

  async 'Сервер: словарь общий для двух пользователей'({ page, url, browser, check }) {
    await openDict(page); await synced(page);
    const b = await newPage(browser, url);
    await openDict(b.page); await synced(b.page);
    await addEntry(page, 'from_a', 'От А', 'From A'); await synced(page);
    check('до обновления B ещё не видит запись', await b.page.locator('.dictionary-table code', { hasText: 'from_a' }).count() === 0);
    await b.page.getByRole('button', { name: 'Обновить с сервера' }).click();
    await b.page.locator('.dictionary-table code', { hasText: 'from_a' }).waitFor();
    check('после «Обновить с сервера» B видит запись A', await b.page.locator('.dictionary-table code', { hasText: 'from_a' }).count() === 1);
    await addEntry(b.page, 'from_b', 'От Б', 'From B'); await synced(b.page);
    await page.getByRole('button', { name: 'Обновить с сервера' }).click();
    await page.locator('.dictionary-table code', { hasText: 'from_b' }).waitFor();
    const keys = await page.locator('.dictionary-table code').allInnerTexts();
    check('у A обе записи (чужая не затёрла свою и наоборот)', keys.includes('from_a') && keys.includes('from_b'));
    await b.context.close();
  },

  async 'Сервер: правка поверх чужих изменений не затирает их'({ page, url, browser, check }) {
    await openDict(page); await synced(page);
    await addEntry(page, 'shared_one', 'Один', 'One'); await synced(page);
    const b = await newPage(browser, url);
    await openDict(b.page); await synced(b.page);
    // A добавляет ключ, B (не обновляясь) правит другой — оба должны остаться на сервере
    await addEntry(page, 'a_new', 'А', 'A'); await synced(page);
    await b.page.locator('.dictionary-table tr', { hasText: 'shared_one' }).locator('input').nth(1).fill('One (edited by B)');
    await synced(b.page);
    const d = await serverDict(page);
    check('на сервере есть ключ A и правка B', d.ru.a_new === 'А' && d.en.shared_one === 'One (edited by B)');
    const keys = await b.page.locator('.dictionary-table code').allInnerTexts();
    check('B после сохранения сразу видит ключ A', keys.includes('a_new'));
    await b.context.close();
  },

  async 'Сервер: офлайн-режим и повторная отправка'({ page, apiState, check }) {
    await openDict(page); await synced(page);
    apiState.offline = true;
    await addEntry(page, 'offline_key', 'Офлайн', 'Offline');
    await page.waitForFunction(() => document.querySelector('[data-sync]')?.dataset.sync === 'offline', null, { timeout: 8000 });
    check('статус «сервер недоступен»', (await page.locator('.dictionary-sync').innerText()).includes('Сервер недоступен'));
    check('запись осталась в таблице', await page.locator('.dictionary-table code', { hasText: 'offline_key' }).count() === 1);
    await page.reload(); await openDict(page);
    check('после перезагрузки без сервера запись есть (localStorage)', await page.locator('.dictionary-table code', { hasText: 'offline_key' }).count() === 1);
    apiState.offline = false;
    await page.getByRole('button', { name: 'Обновить с сервера' }).click();
    await synced(page);
    check('связь вернулась — запись ушла на сервер', (await serverDict(page)).ru.offline_key === 'Офлайн');
  },

  async 'Сервер: локальный словарь переносится на пустой сервер'({ page, check }) {
    await openDict(page); await synced(page); // дождаться первого подключения, иначе оно перезапишет подставленные данные
    await page.evaluate(() => localStorage.setItem('jgb.sharedDictionary', JSON.stringify({ ru: { old_local: 'Старое' }, en: { old_local: 'Old' } })));
    await page.reload(); await openDict(page); await synced(page);
    check('локальная запись видна', await page.locator('.dictionary-table code', { hasText: 'old_local' }).count() === 1);
    await synced(page);
    check('и поднята на сервер', (await serverDict(page)).en.old_local === 'Old');
  },

  async 'Словарь: переименование ключа'({ page, check }) {
    await openDict(page); await synced(page);
    await addEntry(page, 'old_name', 'Текст', 'Text'); await synced(page);
    await page.getByRole('button', { name: 'Переименовать old_name' }).click();
    const input = page.locator('.dictionary-table input[aria-label=Переименовать]');
    await input.fill('1bad'); await input.press('Enter');
    check('некорректное имя отклонено, ключ прежний', await page.locator('.dictionary-error').count() === 1 && await page.locator('.dictionary-table input[aria-label=Переименовать]').count() === 1);
    await input.fill('new_name'); await input.press('Enter');
    await synced(page);
    const keys = await page.locator('.dictionary-table code').allInnerTexts();
    check('в таблице новый ключ, старого нет', keys.includes('new_name') && !keys.includes('old_name'));
    const d = await serverDict(page);
    check('на сервере переименовано, переводы сохранены', d.ru.new_name === 'Текст' && d.en.new_name === 'Text' && d.ru.old_name === undefined);
  },

  async 'Сервер: сохранить форму и открыть из списка'({ page, url, browser, specText, check }) {
    await loadSpec(page, specText);
    await page.getByRole('button', { name: 'Сохранить на сервер' }).click();
    await page.locator('.server-ok').waitFor();
    const msg = await page.locator('.server-ok').innerText();
    const id = (msg.match(/[a-f0-9]{12}/) || [])[0];
    check('сервер вернул id из 12 hex-символов', Boolean(id));
    check('кнопка теперь «Обновить на сервере»', await page.getByRole('button', { name: 'Обновить на сервере' }).count() === 1);
    const b = await newPage(browser, url);
    await b.page.locator('.server-tools select').selectOption(id);
    await b.page.locator('.form-renderer').waitFor();
    check('другой пользователь открыл форму по списку', await b.page.getByText('Имя пользователя').count() > 0);
    await b.context.close();
  },

  async 'Сервер: некорректную спецификацию отклоняет'({ page, check }) {
    await page.locator('#spec-text').fill(JSON.stringify({ title: 'X', elements: [{ name: 'a', label: 'A', type: 'nope' }] }));
    await page.getByRole('button', { name: 'Сохранить на сервер' }).click();
    await page.locator('.server-error').waitFor();
    check('показано сообщение об отклонении', (await page.locator('.server-error').innerText()).includes('отклонил'));
    check('в списке на сервере ничего не появилось', (await page.evaluate(() => fetch('/api/specs').then((r) => r.json()))).length === 0);
  },

  async 'Сервер недоступен: сохранение формы сообщает об ошибке'({ page, apiState, specText, check }) {
    await loadSpec(page, specText);
    apiState.offline = true;
    await page.getByRole('button', { name: 'Сохранить на сервер' }).click();
    await page.locator('.server-error').waitFor();
    check('сообщение «Сервер недоступен»', (await page.locator('.server-error').innerText()).includes('Сервер недоступен'));
    check('форма при этом продолжает работать', await page.getByText('Имя пользователя').count() > 0);
  },

  async 'Конструктор: значения предпросмотра не сбрасываются при правках'({ page, check }) {
    await openBuilder(page); await addElement(page, 'text');
    const input = page.locator('.form-renderer input[type=text]');
    await input.fill('Иван');
    await addElement(page, 'checkbox');
    check('после добавления поля введённое значение осталось', (await page.locator('.form-renderer input[type=text]').first().inputValue()) === 'Иван');
    await editorField(page, 'Описание (description)').locator('input').fill('подсказка');
    check('и после правки свойства тоже', (await page.locator('.form-renderer input[type=text]').first().inputValue()) === 'Иван');
  },
};
