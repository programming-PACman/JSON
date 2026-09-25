import { UI_STRINGS } from './i18n.js';

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

// Валидирует КАЖДЫЙ элемент array по правилам itemType.
export function validateArrayItems(element, items, locale) {
  if (!Array.isArray(items)) return [];
  const itemElement = { label: element.label, type: element.itemType };
  return items.map((item) => validateValue(itemElement, item, locale));
}

// Валидирует КАЖДУЮ ячейку КАЖДОЙ строки matrix по правилам её столбца.
export function validateMatrixRows(element, rows, locale) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const rowErrors = {};
    element.columns.forEach((col) => {
      const message = validateValue(col, row?.[col.name], locale);
      if (message) rowErrors[col.name] = message;
    });
    return rowErrors;
  });
}

// Валидирует КАЖДОЕ поле КАЖДОЙ записи list по правилам поля из template —
// тот же паттерн, что validateMatrixRows, просто "столбцы" называются "template".
export function validateListRows(element, rows, locale) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const rowErrors = {};
    element.template.forEach((field) => {
      const message = validateValue(field, row?.[field.name], locale);
      if (message) rowErrors[field.name] = message;
    });
    return rowErrors;
  });
}

export function hasAnyArrayError(errs) { return errs.some((m) => m !== null); }
export function hasAnyMatrixError(errs) { return errs.some((row) => Object.keys(row).length > 0); }
export function hasAnyListError(errs) { return errs.some((row) => Object.keys(row).length > 0); }
