// Проверка значения поля при вводе.
// TODO: email/regex, кастомные сообщения об ошибках — следующие этапы.
export function validateValue(element, value) {
  if (element.required && (value === undefined || value === null || value === '')) {
    return `Поле "${element.label}" обязательно для заполнения`;
  }

  if (value === undefined || value === null || value === '') return null;

  if (element.type === 'number') {
    const num = Number(value);
    if (Number.isNaN(num)) return 'Введите число';
    if (element.min !== undefined && num < element.min) return `Значение не может быть меньше ${element.min}`;
    if (element.max !== undefined && num > element.max) return `Значение не может быть больше ${element.max}`;
  }

  if (element.type === 'text' || element.type === 'textarea') {
    if (element.minLength !== undefined && value.length < element.minLength) {
      return `Минимальная длина — ${element.minLength} символов`;
    }
    if (element.maxLength !== undefined && value.length > element.maxLength) {
      return `Максимальная длина — ${element.maxLength} символов`;
    }
  }

  if (element.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Введите корректный e-mail';
  }

  return null;
}
