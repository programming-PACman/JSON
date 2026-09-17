import { resolveText } from '../core/i18n.js';

// Повторяющаяся группа простых полей по шаблону template — например,
// список контактов, где у каждого своё ФИО и email.
export default function ListField({ element, value, onChange, locale, translations }) {
  const rows = Array.isArray(value) ? value : [];

  const emptyRow = () => Object.fromEntries(element.template.map((f) => [f.name, '']));
  const updateField = (rowIndex, fieldName, v) => {
    const next = rows.map((row, i) => (i === rowIndex ? { ...row, [fieldName]: v } : row));
    onChange(next);
  };
  const addRow = () => onChange([...rows, emptyRow()]);
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="list-wrap">
      {rows.map((row, rowIndex) => (
        <fieldset className="list-row" key={rowIndex}>
          <legend>{(element.rowLabel || 'Запись {index}').replace('{index}', rowIndex + 1)}</legend>
          {element.template.map((fieldSpec) => {
            const fLabel = resolveText(fieldSpec, 'label', locale, translations) ?? fieldSpec.label;
            return (
              <div className="field" key={fieldSpec.name}>
                <label>{fLabel}</label>
                <input
                  type={fieldSpec.type === 'number' ? 'number' : fieldSpec.type === 'email' ? 'email' : 'text'}
                  value={row[fieldSpec.name] ?? ''}
                  onChange={(e) =>
                    updateField(rowIndex, fieldSpec.name, fieldSpec.type === 'number' ? Number(e.target.value) : e.target.value)
                  }
                />
              </div>
            );
          })}
          <button type="button" onClick={() => removeRow(rowIndex)}>Удалить запись</button>
        </fieldset>
      ))}
      <button type="button" onClick={addRow}>+ Добавить</button>
    </div>
  );
}
