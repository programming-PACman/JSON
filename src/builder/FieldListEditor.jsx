import { sanitizeName, nextName } from './builderUtils.js';

const SIMPLE_TYPES = ['text', 'number', 'email', 'date'];

// Редактор массива [{ name, label, type }] — общий для columns (matrix) и
// template (list), поэтому один компонент вместо двух почти одинаковых.
export default function FieldListEditor({ fields, onChange, namePlaceholder }) {
  const items = Array.isArray(fields) ? fields : [];
  const names = items.map((f) => f.name);

  const update = (i, patch) => {
    const next = items.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    onChange(next);
  };
  const add = () => {
    const name = nextName('field', names);
    onChange([...items, { name, label: 'Новое поле', type: 'text' }]);
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="fieldlist-editor">
      {items.map((f, i) => (
        <div className="fieldlist-editor-row" key={i}>
          <input
            placeholder={namePlaceholder || 'name'}
            value={f.name ?? ''}
            onChange={(e) => update(i, { name: sanitizeName(e.target.value) })}
          />
          <input placeholder="label" value={f.label ?? ''} onChange={(e) => update(i, { label: e.target.value })} />
          <select value={f.type} onChange={(e) => update(i, { type: e.target.value })}>
            {SIMPLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button type="button" onClick={() => remove(i)} disabled={items.length <= 1}>✕</button>
        </div>
      ))}
      <button type="button" onClick={add}>+ Поле</button>
    </div>
  );
}
