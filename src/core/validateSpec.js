// Начальная версия валидации JSON-спецификации.
// Проверяет только самое необходимое: наличие title и elements,
// у каждого элемента — name/label/type, и что type — один из
// поддерживаемых на этом этапе типов.
// TODO: bind (data binding), array/matrix/list, уникальность имён — следующие этапы.

import { extractIdentifiers } from './expression.js';

const SUPPORTED_TYPES = ['text', 'textarea', 'number', 'email', 'date', 'select', 'radio', 'checkbox', 'array', 'matrix', 'list'];
const ARRAY_ITEM_TYPES = ['text', 'number', 'email', 'date'];

export function validateSpec(spec) {
  const errors = [];

  if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) {
    return [{ path: '$', message: 'Спецификация должна быть JSON-объектом' }];
  }

  if (typeof spec.title !== 'string' || spec.title.trim() === '') {
    errors.push({ path: 'title', message: 'Поле title обязательно и должно быть строкой' });
  }

  if (!Array.isArray(spec.elements)) {
    errors.push({ path: 'elements', message: 'Поле elements обязательно и должно быть массивом' });
    return errors;
  }

  spec.elements.forEach((el, index) => {
    const path = `elements[${index}]`;

    if (typeof el.name !== 'string' || el.name.trim() === '') {
      errors.push({ path: `${path}.name`, message: 'Поле name обязательно' });
    }
    if (typeof el.label !== 'string' || el.label.trim() === '') {
      errors.push({ path: `${path}.label`, message: 'Поле label обязательно' });
    }
    if (!SUPPORTED_TYPES.includes(el.type)) {
      errors.push({ path: `${path}.type`, message: `Тип "${el.type}" пока не поддерживается` });
    }
    if ((el.type === 'select' || el.type === 'radio') && !el.bind?.optionsSource && (!Array.isArray(el.options) || el.options.length === 0)) {
      errors.push({ path: `${path}.options`, message: `Для типа ${el.type} нужен непустой options либо bind.optionsSource` });
    }
    if (el.type === 'array' && !ARRAY_ITEM_TYPES.includes(el.itemType)) {
      errors.push({ path: `${path}.itemType`, message: 'Для типа array нужен допустимый itemType' });
    }
    if (el.type === 'matrix' && (!Array.isArray(el.columns) || el.columns.length === 0)) {
      errors.push({ path: `${path}.columns`, message: 'Для типа matrix нужен непустой columns' });
    }
    if (el.type === 'list' && (!Array.isArray(el.template) || el.template.length === 0)) {
      errors.push({ path: `${path}.template`, message: 'Для типа list нужен непустой template' });
    }
  });

  errors.push(...validateBindings(spec.elements));

  return errors;
}

// Проверяет, что bind ссылается на существующие поля и выражения безопасны/корректны.
function validateBindings(elements) {
  const errors = [];
  const names = new Set(elements.map((el) => el.name));

  elements.forEach((el) => {
    if (!el.bind) return;
    const path = `elements[name=${el.name}]`;

    if (el.bind.optionsSource && !names.has(el.bind.optionsSource)) {
      errors.push({ path: `${path}.bind.optionsSource`, message: `Элемент "${el.bind.optionsSource}" не существует` });
    }
    ['computed', 'visibleWhen'].forEach((key) => {
      if (!el.bind[key]) return;
      let ids;
      try {
        ids = extractIdentifiers(el.bind[key]);
      } catch (e) {
        errors.push({ path: `${path}.bind.${key}`, message: `Некорректное выражение: ${e.message}` });
        return;
      }
      const unknown = ids.find((id) => !['true', 'false'].includes(id) && !names.has(id));
      if (unknown) errors.push({ path: `${path}.bind.${key}`, message: `Неизвестный идентификатор "${unknown}"` });
    });
  });

  return errors;
}
