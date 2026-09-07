// Проверка значения поля при вводе. Пока только "обязательно заполнено".
// TODO: min/max, длина строки, email/regex — следующие этапы.
export function validateValue(element, value) {
  if (element.required && (value === undefined || value === null || value === '')) {
    return `Поле "${element.label}" обязательно для заполнения`;
  }
  return null;
}
