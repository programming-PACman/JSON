import { useState } from 'react';

// Список инпутов одного типа с добавлением/удалением/перестановкой строк.
// Перестановка — через нативный HTML5 drag-n-drop (без сторонних библиотек):
// перетаскиваем строку за "ручку" (⠿), drop меняет её местами с той, над
// которой отпустили. error — массив ["ошибка"|null, ...], параллельный items.
export default function ArrayField({ element, value, error, onChange }) {
  const items = Array.isArray(value) ? value : [];
  const inputType = element.itemType === 'number' ? 'number' : element.itemType === 'email' ? 'email' : element.itemType === 'date' ? 'date' : 'text';
  const canAdd = element.maxItems === undefined || items.length < element.maxItems;
  const canRemove = items.length > (element.minItems ?? 0);
  const [dragIndex, setDragIndex] = useState(null);

  const update = (i, v) => {
    const next = [...items];
    next[i] = v;
    onChange(next);
  };
  const add = () => onChange([...items, '']);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  const handleDrop = (targetIndex) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next);
    setDragIndex(null);
  };

  return (
    <div className="array-list">
      {items.map((item, i) => (
        <div
          className={`array-row${dragIndex === i ? ' dragging' : ''}`}
          key={i}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(i)}
        >
          <span
            className="drag-handle"
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragEnd={() => setDragIndex(null)}
            title="Перетащить для изменения порядка"
          >
            ⠿
          </span>
          <div className="array-row-input">
            <input
              type={inputType}
              value={item ?? ''}
              onChange={(e) => update(i, element.itemType === 'number' ? Number(e.target.value) : e.target.value)}
            />
            {error?.[i] && <p className="field-error">{error[i]}</p>}
          </div>
          <button type="button" onClick={() => remove(i)} disabled={!canRemove}>✕</button>
        </div>
      ))}
      <button type="button" onClick={add} disabled={!canAdd}>+ Добавить</button>
    </div>
  );
}
