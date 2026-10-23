import { listDependencies, KIND_LABELS } from './builderUtils.js';

// Наглядная карта зависимостей формы: «источник ──вид──▶ зависимое поле».
// Имена кликабельны — выбирают элемент в конструкторе.
export default function DependencyView({ spec, selectedIndex, onSelect }) {
  const edges = listDependencies(spec);
  const indexOf = (name) => spec.elements.findIndex((e) => e.name === name);
  const labelOf = (name) => spec.elements.find((e) => e.name === name)?.label || name;
  const selectedName = selectedIndex !== null ? spec.elements[selectedIndex]?.name : null;

  const chip = (name) => (
    <button
      type="button"
      className={`secondary dep-chip${name === selectedName ? ' selected' : ''}`}
      title={labelOf(name)}
      onClick={() => { const i = indexOf(name); if (i >= 0) onSelect(i); }}
    >
      {name}
    </button>
  );

  return (
    <div className="dependency-view">
      <h3>Зависимости ({edges.length})</h3>
      {edges.length === 0 ? (
        <p className="field-hint">Связей между полями пока нет. Добавьте «Показывать по условию», вычисляемое значение или источник вариантов.</p>
      ) : (
        <ul>
          {edges.map((e, i) => (
            <li key={i} className="dep-row">
              {chip(e.source)}
              <span className="dep-arrow">── {KIND_LABELS[e.kind] ?? e.kind} ──▶</span>
              {chip(e.target)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
