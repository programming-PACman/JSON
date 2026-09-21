// i18n для двух РАЗНЫХ источников текста (см. обсуждение):
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
