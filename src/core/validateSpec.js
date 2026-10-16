import { extractIdentifiers, checkExpressionSyntax } from './expression.js';

const SUPPORTED_TYPES = ['text', 'textarea', 'number', 'email', 'date', 'select', 'radio', 'checkbox', 'array', 'matrix', 'list'];
const ARRAY_ITEM_TYPES = ['text', 'number', 'email', 'date'];
// Что умеют рисовать и проверять MatrixField/ListField.
const NESTED_TYPES = ['text', 'number', 'email'];

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

  const seenNames = new Set();

  spec.elements.forEach((el, index) => {
    const path = `elements[${index}]`;

    if (typeof el.name !== 'string' || el.name.trim() === '') {
      errors.push({ path: `${path}.name`, message: 'Поле name обязательно' });
    } else if (seenNames.has(el.name)) {
      errors.push({ path: `${path}.name`, message: `Имя "${el.name}" уже используется другим элементом` });
    } else {
      seenNames.add(el.name);
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
    if (Array.isArray(el.options)) {
      const seenValues = new Set();
      el.options.forEach((opt, oi) => {
        const optPath = `${path}.options[${oi}]`;
        if (opt === null || typeof opt !== 'object' || opt.value === undefined || opt.value === '') {
          errors.push({ path: `${optPath}.value`, message: 'У варианта обязательно значение value' });
        } else if (seenValues.has(opt.value)) {
          errors.push({ path: `${optPath}.value`, message: `Значение "${opt.value}" повторяется среди вариантов` });
        } else {
          seenValues.add(opt.value);
        }
        if (opt === null || typeof opt !== 'object' || typeof opt.label !== 'string' || opt.label.trim() === '') {
          errors.push({ path: `${optPath}.label`, message: 'У варианта обязательна подпись label' });
        }
      });
    }
    if (el.type === 'matrix' && Array.isArray(el.columns)) errors.push(...validateNestedFields(el.columns, `${path}.columns`));
    if (el.type === 'list' && Array.isArray(el.template)) errors.push(...validateNestedFields(el.template, `${path}.template`));
    if (el.type === 'array' && !ARRAY_ITEM_TYPES.includes(el.itemType)) {
      errors.push({ path: `${path}.itemType`, message: 'Для типа array нужен допустимый itemType' });
    }
    if (el.type === 'matrix' && (!Array.isArray(el.columns) || el.columns.length === 0)) {
      errors.push({ path: `${path}.columns`, message: 'Для типа matrix нужен непустой columns' });
    }
    if (el.type === 'list' && (!Array.isArray(el.template) || el.template.length === 0)) {
      errors.push({ path: `${path}.template`, message: 'Для типа list нужен непустой template' });
    }
    if (['array', 'matrix', 'list'].includes(el.type)) {
      if (el.minItems !== undefined && (typeof el.minItems !== 'number' || el.minItems < 0)) {
        errors.push({ path: `${path}.minItems`, message: 'minItems должно быть неотрицательным числом' });
      }
      if (el.maxItems !== undefined && (typeof el.maxItems !== 'number' || el.maxItems < 0)) {
        errors.push({ path: `${path}.maxItems`, message: 'maxItems должно быть неотрицательным числом' });
      }
      if (typeof el.minItems === 'number' && typeof el.maxItems === 'number' && el.minItems > el.maxItems) {
        errors.push({ path, message: 'minItems не может быть больше maxItems' });
      }
    }
  });

  errors.push(...validateBindings(spec.elements));

  return errors;
}

function validateBindings(elements) {
  const errors = [];
  const byName = new Map();
  elements.forEach((el) => {
    if (typeof el.name === 'string' && !byName.has(el.name)) byName.set(el.name, el);
  });
  const deps = {}; // имя -> от каких полей оно зависит

  elements.forEach((el) => {
    if (!el.bind) return;
    const path = `elements[name=${el.name}]`;
    const myDeps = [];

    if (el.bind.optionsSource) {
      const source = byName.get(el.bind.optionsSource);
      if (!source) {
        errors.push({ path: `${path}.bind.optionsSource`, message: `Элемент "${el.bind.optionsSource}" не существует` });
      } else {
        // Варианты берутся из ЗНАЧЕНИЯ источника, поэтому оно обязано быть списком.
        if (source.type !== 'array') {
          errors.push({
            path: `${path}.bind.optionsSource`,
            message: `Источник вариантов "${source.name}" должен быть полем типа array (сейчас: ${source.type})`,
          });
        }
        myDeps.push(source.name);
      }
    }

    ['computed', 'visibleWhen'].forEach((key) => {
      if (!el.bind[key]) return;
      const syntaxError = checkExpressionSyntax(el.bind[key]);
      if (syntaxError) {
        errors.push({ path: `${path}.bind.${key}`, message: `Некорректное выражение: ${syntaxError}` });
        return;
      }
      extractIdentifiers(el.bind[key]).forEach((id) => {
        if (['true', 'false'].includes(id)) return;
        if (byName.has(id)) myDeps.push(id);
        else errors.push({ path: `${path}.bind.${key}`, message: `Неизвестный идентификатор "${id}"` });
      });
    });

    if (myDeps.includes(el.name)) {
      errors.push({ path: `${path}.bind`, message: 'Поле не может зависеть от самого себя' });
    }
    deps[el.name] = [...new Set(myDeps)].filter((d) => d !== el.name);
  });

  // Циклы: обход в глубину с трёхцветной разметкой (белый — не был, серый — в процессе, чёрный — готово).
  const state = {};
  const stack = [];
  function visit(name) {
    state[name] = 'gray';
    stack.push(name);
    for (const dep of deps[name] || []) {
      if (state[dep] === 'gray') {
        const chain = [...stack.slice(stack.indexOf(dep)), dep].join(' → ');
        errors.push({ path: `elements[name=${name}].bind`, message: `Циклическая зависимость: ${chain}` });
      } else if (!state[dep]) {
        visit(dep);
      }
    }
    stack.pop();
    state[name] = 'black';
  }
  Object.keys(deps).forEach((name) => { if (!state[name]) visit(name); });

  return errors;
}

// Вложенные поля (columns у matrix, template у list): name/label/type обязательны,
// имена уникальны В ПРЕДЕЛАХ одного набора, тип — только из простых.
function validateNestedFields(fields, basePath) {
  const errors = [];
  const seen = new Set();
  fields.forEach((f, i) => {
    const path = `${basePath}[${i}]`;
    if (f === null || typeof f !== 'object') {
      errors.push({ path, message: 'Поле должно быть объектом' });
      return;
    }
    if (typeof f.name !== 'string' || f.name.trim() === '') {
      errors.push({ path: `${path}.name`, message: 'Поле name обязательно' });
    } else if (seen.has(f.name)) {
      errors.push({ path: `${path}.name`, message: `Имя "${f.name}" повторяется внутри набора полей` });
    } else {
      seen.add(f.name);
    }
    if (typeof f.label !== 'string' || f.label.trim() === '') {
      errors.push({ path: `${path}.label`, message: 'Поле label обязательно' });
    }
    if (!NESTED_TYPES.includes(f.type)) {
      errors.push({ path: `${path}.type`, message: `Тип "${f.type}" здесь не поддерживается (доступно: ${NESTED_TYPES.join(', ')})` });
    }
  });
  return errors;
}
