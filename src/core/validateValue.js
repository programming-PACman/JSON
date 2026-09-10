import { UI_STRINGS } from './i18n.js';

// Проверка значения поля при вводе.
// locale/label — для перевода текста ошибки; label уже РЕЗОЛВЛЕН вызывающим
// кодом через resolveText (эта функция не обязана знать про translations).
export function validateValue(element, value, locale = 'ru', label = element.label) {
  const t = UI_STRINGS[locale] || UI_STRINGS.ru;

  if (element.required && (value === undefined || value === null || value === '')) {
    return t.required(label);
  }

  if (value === undefined || value === null || value === '') return null;

  if (element.type === 'number') {
    const num = Number(value);
    if (Number.isNaN(num)) return t.invalidNumber;
    if (element.min !== undefined && num < element.min) return t.minValue(element.min);
    if (element.max !== undefined && num > element.max) return t.maxValue(element.max);
  }

  if (element.type === 'text' || element.type === 'textarea') {
    if (element.minLength !== undefined && value.length < element.minLength) return t.minLength(element.minLength);
    if (element.maxLength !== undefined && value.length > element.maxLength) return t.maxLength(element.maxLength);
  }

  if (element.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return t.invalidEmail;

  return null;
}
