import { useState } from 'react';
import { resolveText } from '../core/i18n.js';

// Повторяющаяся группа полей по шаблону template. error — массив
// [{ fieldName: "ошибка" }, ...], параллельный rows (validateListRows).
export default function ListField({ element, value, error, onChange, locale, translations }) {
  const rows = Array.isArray(value) ? value : [];
  const canAdd = element.maxItems === undefined || rows.length < element.maxItems;
  const canRemove = rows.length > (element.minItems ?? 0);
  const [dragIndex, setDragIndex] = useState(null);

  const emptyRow = () => Object.fromEntries(element.template.map((f) => [f.name, '']));
  const updateField = (rowIndex, fieldName, v) => {
    const next = rows.map((row, i) => (i === rowIndex ? { ...row, [fieldName]: v } : row));
    onChange(next);
  };
  const addRow = () => onChange([...rows, emptyRow()]);
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));

  const handleDrop = (targetIndex) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...rows];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next);
    setDragIndex(null);
  };

  return (
    <div className="list-wrap">
      {rows.map((row, rowIndex) => (
        <fieldset
          className={`list-row${dragIndex === rowIndex ? ' dragging' : ''}`}
          key={rowIndex}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(rowIndex)}
        >
          <legend>
            <span
              className="drag-handle"
              draggable
              onDragStart={() => setDragIndex(rowIndex)}
              onDragEnd={() => setDragIndex(null)}
              title="Перетащить для изменения порядка"
            >
              ⠿
            </span>
            {(element.rowLabel || 'Запись {index}').replace('{index}', rowIndex + 1)}
          </legend>
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
                {error?.[rowIndex]?.[fieldSpec.name] && <p className="field-error">{error[rowIndex][fieldSpec.name]}</p>}
              </div>
            );
          })}
          <button type="button" onClick={() => removeRow(rowIndex)} disabled={!canRemove}>Удалить запись</button>
        </fieldset>
      ))}
      <button type="button" onClick={addRow} disabled={!canAdd}>+ Добавить</button>
    </div>
  );
}
