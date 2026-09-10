// Начальная версия валидации JSON-спецификации.
// Проверяет только самое необходимое: наличие title и elements,
// у каждого элемента — name/label/type, и что type — один из
// поддерживаемых на этом этапе типов.
// TODO: bind (data binding), array/matrix/list, уникальность имён — следующие этапы.

const SUPPORTED_TYPES = ['text', 'textarea', 'number', 'email', 'date', 'select', 'radio', 'checkbox'];

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
    if ((el.type === 'select' || el.type === 'radio') && (!Array.isArray(el.options) || el.options.length === 0)) {
      errors.push({ path: `${path}.options`, message: `Для типа ${el.type} нужен непустой options` });
    }
    if (el.type === 'radio' && (!Array.isArray(el.options) || el.options.length === 0)) {
      errors.push({ path: `${path}.options`, message: 'Для типа radio нужен непустой options' });
    }
  });

  return errors;
}
