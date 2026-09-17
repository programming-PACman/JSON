// Список инпутов одного типа с добавлением/удалением/перестановкой строк.
// error — массив ["ошибка"|null, ...], параллельный items (validateArrayItems).
export default function ArrayField({ element, value, error, onChange }) {
  const items = Array.isArray(value) ? value : [];
  const inputType = element.itemType === 'number' ? 'number' : element.itemType === 'email' ? 'email' : element.itemType === 'date' ? 'date' : 'text';

  const update = (i, v) => {
    const next = [...items];
    next[i] = v;
    onChange(next);
  };
  const add = () => onChange([...items, '']);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const target = i + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  };

  return (
    <div className="array-list">
      {items.map((item, i) => (
        <div className="array-row" key={i}>
          <div className="array-row-input">
            <input
              type={inputType}
              value={item ?? ''}
              onChange={(e) => update(i, element.itemType === 'number' ? Number(e.target.value) : e.target.value)}
            />
            {error?.[i] && <p className="field-error">{error[i]}</p>}
          </div>
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
          <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
          <button type="button" onClick={() => remove(i)}>✕</button>
        </div>
      ))}
      <button type="button" onClick={add}>+ Добавить</button>
    </div>
  );
}
