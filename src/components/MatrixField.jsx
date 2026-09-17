import { resolveText } from '../core/i18n.js';

// Таблица со столбцами заданных типов, строки добавляются/удаляются/переставляются.
// error — массив [{ colName: "ошибка" }, ...], параллельный rows (validateMatrixRows).
export default function MatrixField({ element, value, error, onChange, locale, translations }) {
  const rows = Array.isArray(value) ? value : [];

  const emptyRow = () => Object.fromEntries(element.columns.map((c) => [c.name, '']));
  const updateCell = (rowIndex, colName, v) => {
    const next = rows.map((row, i) => (i === rowIndex ? { ...row, [colName]: v } : row));
    onChange(next);
  };
  const addRow = () => onChange([...rows, emptyRow()]);
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const moveRow = (i, dir) => {
    const target = i + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  };

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
                  {error?.[rowIndex]?.[col.name] && <p className="field-error">{error[rowIndex][col.name]}</p>}
                </td>
              ))}
              <td className="matrix-row-actions">
                <button type="button" onClick={() => moveRow(rowIndex, -1)} disabled={rowIndex === 0}>↑</button>
                <button type="button" onClick={() => moveRow(rowIndex, 1)} disabled={rowIndex === rows.length - 1}>↓</button>
                <button type="button" onClick={() => removeRow(rowIndex)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addRow}>+ Добавить строку</button>
    </div>
  );
}
