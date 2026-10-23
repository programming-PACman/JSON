import { moveItem, nextOptionValue } from './builderUtils.js';

// Редактор массива [{ value, label }] — используется для options select/radio.
// Варианты можно переставлять кнопками ↑/↓ (порядок = порядок в выпадающем списке).
export default function OptionsEditor({ options, onChange }) {
  const items = Array.isArray(options) ? options : [];

  const update = (i, patch) => {
    const next = items.map((opt, idx) => (idx === i ? { ...opt, ...patch } : opt));
    onChange(next);
  };
  const add = () => onChange([...items, { value: nextOptionValue(items), label: `Вариант ${items.length + 1}` }]);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const move = (from, to) => onChange(moveItem(items, from, to));

  return (
    <div className="options-editor">
      {items.map((opt, i) => (
        <div className="options-editor-row" key={i}>
          <input placeholder="value" value={opt.value ?? ''} onChange={(e) => update(i, { value: e.target.value })} />
          <input placeholder="label" value={opt.label ?? ''} onChange={(e) => update(i, { label: e.target.value })} />
          <button type="button" className="secondary" title="Выше" aria-label="Выше" onClick={() => move(i, i - 1)} disabled={i === 0}>↑</button>
          <button type="button" className="secondary" title="Ниже" aria-label="Ниже" onClick={() => move(i, i + 1)} disabled={i === items.length - 1}>↓</button>
          <button type="button" title="Удалить вариант" aria-label="Удалить вариант" onClick={() => remove(i)} disabled={items.length <= 1}>✕</button>
        </div>
      ))}
      <button type="button" onClick={add}>+ Вариант</button>
    </div>
  );
}
