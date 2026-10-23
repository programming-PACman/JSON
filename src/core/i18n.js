// i18n для двух РАЗНЫХ источников текста:
// 1. UI_STRINGS — текст самого приложения (кнопки, шаблоны ошибок).
// 2. resolveText — текст ИЗ JSON-спецификации (label полей/опций), у которого
//    есть перевод только если автор спецификации явно его предоставил
//    через translations + *Key (labelKey и т.п.). Без перевода — fallback
//    на исходный текст, старые спецификации без translations не ломаются.

export const UI_STRINGS = {
  ru: {
    appTitle: 'JSON GUI Builder (начальная версия)',
    specLabel: 'JSON-спецификация',
    loadButton: 'Загрузить спецификацию',
    checkButton: 'Проверить',
    clearButton: 'Очистить форму',
    checkOk: '✓ Спецификация корректна, ошибок не найдено',
    fileButton: 'Загрузить файл .json',
    collectButton: 'Собрать данные',
    invalidSpec: 'Спецификация некорректна:',
    selectPlaceholder: 'Выберите значение',
    required: (label) => `Поле "${label}" обязательно для заполнения`,
    invalidNumber: 'Введите число',
    minValue: (min) => `Значение не может быть меньше ${min}`,
    maxValue: (max) => `Значение не может быть больше ${max}`,
    minLength: (n) => `Минимальная длина — ${n} символов`,
    maxLength: (n) => `Максимальная длина — ${n} символов`,
    invalidEmail: 'Введите корректный e-mail',
    builderTab: 'Конструктор',
    previewTab: 'Предпросмотр',
    importJson: 'Импорт JSON',
    copyJson: 'Копировать JSON',
    copied: 'Скопировано',
    copyFailed: 'Не удалось скопировать — выделите текст вручную',
    downloadJson: 'Скачать JSON',
    importFailed: 'Файл не загружен: это не JSON-спецификация (нет массива elements)',
    invalidJson: (msg) => `Некорректный JSON: ${msg}`,
    dragHint: 'Перетащить для изменения порядка',
    addItem: '+ Добавить',
    addRow: '+ Добавить строку',
    removeItem: 'Удалить',
    removeRecord: 'Удалить запись',
    defaultRowLabel: 'Запись {index}',
    dictTab: 'Словарь',
    dictHint: 'Общий словарь переводов: ключи доступны всем формам. Локальные translations формы приоритетнее.',
    dictKey: 'Ключ',
    dictAdd: 'Добавить',
    dictDelete: 'Удалить',
    dictExport: 'Экспорт .json',
    dictImport: 'Импорт .json',
    dictEmpty: 'Словарь пока пуст',
    dictInvalidKey: 'Ключ: латиница, цифры и _, не с цифры',
    dictDuplicateKey: 'Такой ключ уже есть',
    dictNeedText: 'Введите перевод хотя бы для одного языка',
    dictImportError: 'Не удалось прочитать словарь',
    dictMissing: (n) => `Нет перевода для текущего языка у ключей формы: ${n}`,
    dictAllTranslated: 'Все ключи текущей формы переведены',
    dictBaseLocale: 'Русский — базовый язык формы: тексты берутся из её полей label, перевод не требуется',
  },
  en: {
    appTitle: 'JSON GUI Builder (starter version)',
    specLabel: 'JSON specification',
    loadButton: 'Load specification',
    checkButton: 'Validate',
    clearButton: 'Clear form',
    checkOk: '✓ Specification is valid, no errors found',
    fileButton: 'Load .json file',
    collectButton: 'Collect data',
    invalidSpec: 'Specification is invalid:',
    selectPlaceholder: 'Select a value',
    required: (label) => `Field "${label}" is required`,
    invalidNumber: 'Enter a number',
    minValue: (min) => `Value cannot be less than ${min}`,
    maxValue: (max) => `Value cannot be greater than ${max}`,
    minLength: (n) => `Minimum length is ${n} characters`,
    maxLength: (n) => `Maximum length is ${n} characters`,
    invalidEmail: 'Enter a valid email',
    builderTab: 'Builder',
    previewTab: 'Preview',
    importJson: 'Import JSON',
    copyJson: 'Copy JSON',
    copied: 'Copied',
    copyFailed: 'Could not copy — select the text manually',
    downloadJson: 'Download JSON',
    importFailed: 'File not loaded: this is not a JSON specification (no elements array)',
    invalidJson: (msg) => `Invalid JSON: ${msg}`,
    dragHint: 'Drag to reorder',
    addItem: '+ Add',
    addRow: '+ Add row',
    removeItem: 'Remove',
    removeRecord: 'Remove record',
    defaultRowLabel: 'Record {index}',
    dictTab: 'Dictionary',
    dictHint: 'Shared translation dictionary: keys are available to every form. A form\'s own translations take priority.',
    dictKey: 'Key',
    dictAdd: 'Add',
    dictDelete: 'Delete',
    dictExport: 'Export .json',
    dictImport: 'Import .json',
    dictEmpty: 'The dictionary is empty',
    dictInvalidKey: 'Key: letters, digits and _, not starting with a digit',
    dictDuplicateKey: 'This key already exists',
    dictNeedText: 'Enter a translation for at least one language',
    dictImportError: 'Could not read the dictionary',
    dictMissing: (n) => `Keys of the current form with no translation for this language: ${n}`,
    dictAllTranslated: 'All keys of the current form are translated',
    dictBaseLocale: 'Russian is the form\'s base language: texts come from its label fields, no translation needed',
  },
};

// Резолвит переводимое ПОЛЕ элемента спецификации (например 'label').
// Ключ перевода берётся из отдельного поля `${field}Key` (например labelKey) —
// специально НЕ из `name`, чтобы переименование технического имени поля
// не ломало перевод, и чтобы один и тот же ключ можно было переиспользовать
// у нескольких элементов с одинаковым текстом.
export function resolveText(element, field, locale, translations) {
  const key = element?.[`${field}Key`];
  if (key && translations?.[locale]?.[key] !== undefined) {
    return translations[locale][key];
  }
  return element?.[field];
}
