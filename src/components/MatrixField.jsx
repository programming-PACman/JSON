import { resolveText } from '../core/i18n.js';

// Таблица со столбцами заданных типов, строки добавляются/удаляются.
export default function MatrixField({ element, value, onChange, locale, translations }) {
  const rows = Array.isArray(value) ? value : [];

  const emptyRow = () => Object.fromEntries(element.columns.map((c) => [c.name, '']));
  const updateCell = (rowIndex, colName, v) => {
    const next = rows.map((row, i) => (i === rowIndex ? { ...row, [colName]: v } : row));
    onChange(next);
  };
  const addRow = () => onChange([...rows, emptyRow()]);
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="matrix-wrap">
      <table className="matrix-table">
        <thead>
          <tr>
            {element.columns.map((col) => (
              <th key={col.name}>{resolveText(col, 'label', locale, translations) ?? col.label}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {element.columns.map((col) => (
                <td key={col.name}>
                  <input
                    type={col.type === 'number' ? 'number' : 'text'}
                    value={row[col.name] ?? ''}
                    onChange={(e) => updateCell(rowIndex, col.name, col.type === 'number' ? Number(e.target.value) : e.target.value)}
                  />
                </td>
              ))}
              <td><button type="button" onClick={() => removeRow(rowIndex)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addRow}>+ Добавить строку</button>
    </div>
  );
}
