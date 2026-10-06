import { useState } from 'react';
import { resolveText } from '../core/i18n.js';

// Таблица со столбцами заданных типов. Перестановка строк — drag-n-drop
// за ручку (⠿) в первой колонке, тем же принципом, что и ArrayField.
export default function MatrixField({ element, value, error, onChange, locale, translations }) {
  const rows = Array.isArray(value) ? value : [];
  const canAdd = element.maxItems === undefined || rows.length < element.maxItems;
  const canRemove = rows.length > (element.minItems ?? 0);
  const [dragIndex, setDragIndex] = useState(null);

  const emptyRow = () => Object.fromEntries(element.columns.map((c) => [c.name, '']));
  const updateCell = (rowIndex, colName, v) => {
    const next = rows.map((row, i) => (i === rowIndex ? { ...row, [colName]: v } : row));
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
    <div className="matrix-wrap">
      <table className="matrix-table">
        <thead>
          <tr>
            <th />
            {element.columns.map((col) => (
              <th key={col.name}>{resolveText(col, 'label', locale, translations) ?? col.label}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={dragIndex === rowIndex ? 'dragging' : ''}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(rowIndex)}
            >
              <td>
                <span
                  className="drag-handle"
                  draggable
                  onDragStart={() => setDragIndex(rowIndex)}
                  onDragEnd={() => setDragIndex(null)}
                  title="Перетащить для изменения порядка"
                >
                  ⠿
                </span>
              </td>
              {element.columns.map((col) => (
                <td key={col.name}>
                  <input
                    type={col.type === 'number' ? 'number' : 'text'}
                    value={row[col.name] ?? ''}
                    onChange={(e) => updateCell(rowIndex, col.name, col.type === 'number' ? Number(e.target.value) : e.target.value)}
                  />
                  {error?.[rowIndex]?.[col.name] && <p className="field-error">{error[rowIndex][col.name]}</p>}
                </td>
              ))}
              <td><button type="button" onClick={() => removeRow(rowIndex)} disabled={!canRemove}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addRow} disabled={!canAdd}>+ Добавить строку</button>
    </div>
  );
}
