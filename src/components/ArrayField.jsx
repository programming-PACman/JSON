// Список инпутов одного типа с добавлением/удалением строк.
export default function ArrayField({ element, value, onChange }) {
  const items = Array.isArray(value) ? value : [];
  const inputType = element.itemType === 'number' ? 'number' : element.itemType === 'email' ? 'email' : element.itemType === 'date' ? 'date' : 'text';

  const update = (i, v) => {
    const next = [...items];
    next[i] = v;
    onChange(next);
  };
  const add = () => onChange([...items, '']);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="array-list">
      {items.map((item, i) => (
        <div className="array-row" key={i}>
          <input
            type={inputType}
            value={item ?? ''}
            onChange={(e) => update(i, element.itemType === 'number' ? Number(e.target.value) : e.target.value)}
          />
          <button type="button" onClick={() => remove(i)}>✕</button>
        </div>
      ))}
      <button type="button" onClick={add}>+ Добавить</button>
    </div>
  );
}
