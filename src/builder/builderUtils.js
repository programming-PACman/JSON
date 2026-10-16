// Вся логика конструктора — чистые функции над обычным JS-объектом спецификации
// { title, description?, elements: [...] }. Состояние конструктора И ЕСТЬ спецификация:
// JSON — результат JSON.stringify(spec), а не место, где пользователь собирает структуру.
// Ни одна функция здесь не знает про React, поэтому их можно тестировать в Node.

import { extractIdentifiers } from '../core/expression.js';

export const ELEMENT_TYPES = [
  { type: 'text', label: 'Текст' },
  { type: 'textarea', label: 'Многострочный текст' },
  { type: 'number', label: 'Число' },
  { type: 'email', label: 'E-mail' },
  { type: 'date', label: 'Дата' },
  { type: 'select', label: 'Выпадающий список' },
  { type: 'radio', label: 'Переключатель (radio)' },
  { type: 'checkbox', label: 'Флажок (checkbox)' },
  { type: 'array', label: 'Массив значений' },
  { type: 'matrix', label: 'Таблица (matrix)' },
  { type: 'list', label: 'Список записей (list)' },
];

export const NESTED_TYPES = ['text', 'number', 'email'];
export const ARRAY_ITEM_TYPES = ['text', 'number', 'email', 'date'];
export const COLLECTION_TYPES = ['array', 'matrix', 'list'];
export const KIND_LABELS = { visibility: 'видимость', options: 'варианты', computed: 'вычисление' };

const TYPE_SPECIFIC_KEYS = [
  'options', 'itemType', 'columns', 'template', 'minItems', 'maxItems',
  'min', 'max', 'minLength', 'maxLength', 'step', 'default',
];

export const typeLabel = (type) => ELEMENT_TYPES.find((t) => t.type === type)?.label ?? type;

/* ---------- имена ---------- */

// Имя поля используется в выражениях (bind.computed / visibleWhen), а парсер
// выражений понимает только латиницу, цифры и "_" — поэтому имена ограничены так же.
export const isValidName = (name) =>
  typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !['true', 'false'].includes(name);

export function sanitizeName(raw) {
  let name = String(raw).replace(/[^A-Za-z0-9_]/g, '');
  if (/^[0-9]/.test(name)) name = `_${name}`;
  return name;
}

export function nextName(base, names) {
  let i = 1;
  while (names.includes(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

/* ---------- создание элементов ---------- */

function typeDefaults(type) {
  switch (type) {
    case 'select':
    case 'radio':
      return { options: [{ value: 'option_1', label: 'Вариант 1' }] };
    case 'checkbox':
      return { default: false };
    case 'array':
      return { itemType: 'text' };
    case 'matrix':
      return { columns: [{ name: 'col_1', label: 'Столбец 1', type: 'text' }] };
    case 'list':
      return { template: [{ name: 'field_1', label: 'Поле 1', type: 'text' }] };
    default:
      return {};
  }
}

export function createElement(type, names) {
  return { name: nextName(type, names), label: typeLabel(type), type, ...typeDefaults(type) };
}

// Удаляет ключ, если значение "пустое" — чтобы в JSON не попадали "" и null.
export function withProp(element, key, value) {
  const next = { ...element };
  if (value === undefined || value === null || value === '') delete next[key];
  else next[key] = value;
  return next;
}

export function setBind(element, key, value) {
  const bind = { ...(element.bind || {}) };
  if (value === undefined || value === null || value === '') delete bind[key];
  else bind[key] = value;
  const next = { ...element };
  if (Object.keys(bind).length > 0) next.bind = bind;
  else delete next.bind;
  return next;
}

// Смена типа: сбрасываем настройки старого типа, добавляем нужное новому,
// убираем зависимости, которые для нового типа не имеют смысла.
export function changeType(element, newType) {
  const next = { ...element };
  TYPE_SPECIFIC_KEYS.forEach((k) => delete next[k]);
  Object.assign(next, { type: newType }, typeDefaults(newType));
  let result = next;
  if (newType !== 'select' && newType !== 'radio') result = setBind(result, 'optionsSource', undefined);
  if (COLLECTION_TYPES.includes(newType)) result = setBind(result, 'computed', undefined);
  return result;
}

/* ---------- операции над спецификацией (всегда возвращают НОВЫЙ объект) ---------- */

export const namesOf = (spec) => spec.elements.map((e) => e.name);

export function addElement(spec, type) {
  const element = createElement(type, namesOf(spec));
  return { spec: { ...spec, elements: [...spec.elements, element] }, index: spec.elements.length };
}

export function duplicateElement(spec, index) {
  const source = spec.elements[index];
  const copy = JSON.parse(JSON.stringify(source));
  copy.name = nextName(source.name.replace(/_\d+$/, '') || 'field', namesOf(spec));
  const elements = [...spec.elements];
  elements.splice(index + 1, 0, copy);
  return { spec: { ...spec, elements }, index: index + 1 };
}

export function deleteElement(spec, index) {
  return { ...spec, elements: spec.elements.filter((_, i) => i !== index) };
}

export function moveElement(spec, from, to) {
  if (from === to || from < 0 || to < 0 || from >= spec.elements.length || to >= spec.elements.length) return spec;
  const elements = [...spec.elements];
  const [moved] = elements.splice(from, 1);
  elements.splice(to, 0, moved);
  return { ...spec, elements };
}

// Куда "переехал" выбранный элемент после перемещения from -> to.
export function selectionAfterMove(selected, from, to) {
  if (selected === null || selected === undefined) return selected;
  if (selected === from) return to;
  if (from < selected && to >= selected) return selected - 1;
  if (from > selected && to <= selected) return selected + 1;
  return selected;
}

export function updateElement(spec, index, element) {
  return { ...spec, elements: spec.elements.map((e, i) => (i === index ? element : e)) };
}

// Заменяет имя поля внутри выражения, не трогая строковые литералы: "тип == \"type\"" остаётся как есть.
export function replaceIdentifier(expression, oldName, newName) {
  return expression.replace(/("(?:[^"\\]|\\.)*")|([A-Za-z_][A-Za-z0-9_]*)/g, (match, str, id) => {
    if (str) return str;
    return id === oldName ? newName : id;
  });
}

// Переименование поля + автоматическое исправление ВСЕХ ссылок на него в чужих bind,
// чтобы переименование не ломало зависимости.
export function renameElement(spec, index, newName) {
  const oldName = spec.elements[index].name;
  if (oldName === newName) return spec;
  const elements = spec.elements.map((el, i) => {
    if (i === index) return { ...el, name: newName };
    if (!el.bind) return el;
    const bind = { ...el.bind };
    if (bind.optionsSource === oldName) bind.optionsSource = newName;
    if (bind.computed) bind.computed = replaceIdentifier(bind.computed, oldName, newName);
    if (bind.visibleWhen) bind.visibleWhen = replaceIdentifier(bind.visibleWhen, oldName, newName);
    return { ...el, bind };
  });
  return { ...spec, elements };
}

/* ---------- условия видимости: интерфейс <-> строка выражения ---------- */

export const OPERATORS = [
  { op: '==', label: 'равно' },
  { op: '!=', label: 'не равно' },
  { op: '>', label: 'больше' },
  { op: '<', label: 'меньше' },
  { op: '>=', label: 'больше или равно' },
  { op: '<=', label: 'меньше или равно' },
];

// Строковые значения — в двойных кавычках. Парсер выражений не поддерживает
// экранирование, поэтому кавычки и обратные слэши из значения убираются.
export function valueToExpr(value) {
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return `"${String(value ?? '').replace(/["\\]/g, '')}"`;
}

export function buildCondition({ field, op, value }) {
  return `${field} ${op} ${valueToExpr(value)}`;
}

// Обратное преобразование. Возвращает null, если выражение сложнее, чем
// "поле оператор значение" — тогда интерфейс показывает его как произвольное.
export function parseCondition(expression) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(==|!=|>=|<=|>|<)\s*(true|false|-?\d+(?:\.\d+)?|"[^"\\]*")\s*$/.exec(expression ?? '');
  if (!m) return null;
  const raw = m[3];
  let value;
  if (raw === 'true') value = true;
  else if (raw === 'false') value = false;
  else if (raw.startsWith('"')) value = raw.slice(1, -1);
  else value = Number(raw);
  return { field: m[1], op: m[2], value };
}

export function defaultConditionValue(sourceElement) {
  if (!sourceElement) return '';
  if (sourceElement.type === 'checkbox') return true;
  if (sourceElement.type === 'number') return 0;
  if ((sourceElement.type === 'select' || sourceElement.type === 'radio') && sourceElement.options?.length) {
    return sourceElement.options[0].value;
  }
  return '';
}

/* ---------- зависимости: список, сводка, ошибки ---------- */

export function listDependencies(spec) {
  const names = new Set(namesOf(spec));
  const result = [];
  spec.elements.forEach((el) => {
    if (!el.bind) return;
    if (el.bind.optionsSource) result.push({ source: el.bind.optionsSource, kind: 'options', target: el.name });
    [['computed', 'computed'], ['visibleWhen', 'visibility']].forEach(([key, kind]) => {
      if (!el.bind[key]) return;
      extractIdentifiers(el.bind[key])
        .filter((id) => names.has(id))
        .forEach((id) => result.push({ source: id, kind, target: el.name }));
    });
  });
  return result;
}

// Краткая сводка для строки списка: "обязательное · 3 варианта · видимость".
export function summarize(element) {
  const parts = [];
  if (element.required) parts.push('обязательное');
  if (element.hidden) parts.push('скрытое');
  if (element.disabled) parts.push('заблокировано');
  if (Array.isArray(element.options) && !element.bind?.optionsSource) parts.push(`вариантов: ${element.options.length}`);
  if (element.bind?.optionsSource) parts.push(`варианты из «${element.bind.optionsSource}»`);
  if (element.type === 'matrix') parts.push(`столбцов: ${element.columns?.length ?? 0}`);
  if (element.type === 'list') parts.push(`полей в записи: ${element.template?.length ?? 0}`);
  if (element.bind?.visibleWhen) parts.push('условная видимость');
  if (element.bind?.computed) parts.push('вычисляется');
  return parts.join(' · ');
}

// Ошибки validateSpec, относящиеся к конкретному элементу. validateSpec пишет пути
// двух видов: elements[3].label (по индексу) и elements[name=foo].bind (по имени).
export function errorsForElement(errors, element, index) {
  const byIndex = new RegExp(`^elements\\[${index}\\](\\.|\\[|$)`);
  const byName = `elements[name=${element.name}]`;
  return errors.filter((e) => byIndex.test(e.path) || e.path.startsWith(byName));
}
