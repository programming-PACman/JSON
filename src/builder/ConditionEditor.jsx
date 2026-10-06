import { OPERATORS, buildCondition, parseCondition, defaultConditionValue } from './builderUtils.js';

// Визуальный конструктор для bind.visibleWhen: "поле [равно] значение".
// Если текущее выражение сложнее простого "поле оп значение" (например,
// с && или ||), parseCondition вернёт null — тогда просто показываем
// редактируемый текст, НЕ пытаясь молча что-то под него подогнать
// (это честнее, чем притворяться, что визуальный редактор понял выражение).
export default function ConditionEditor({ expression, otherElements, onChange }) {
  const parsed = parseCondition(expression);

  if (expression && parsed === null) {
    return (
      <div className="condition-editor">
        <p className="field-hint">
          Выражение сложнее, чем «поле оператор значение» — редактируется как текст.
        </p>
        <input value={expression} onChange={(e) => onChange(e.target.value)} />
        <button type="button" onClick={() => onChange('')}>Очистить и начать визуально</button>
      </div>
    );
  }

  const field = parsed?.field ?? otherElements[0]?.name ?? '';
  const op = parsed?.op ?? '==';
  const value = parsed?.value ?? defaultConditionValue(otherElements.find((e) => e.name === field));
  const sourceElement = otherElements.find((e) => e.name === field);

  const update = (patch) => {
    const next = { field, op, value, ...patch };
    onChange(buildCondition(next));
  };

  if (otherElements.length === 0) {
    return <p className="field-hint">Нет других полей, от которых можно зависеть.</p>;
  }

  return (
    <div className="condition-editor">
      <select value={field} onChange={(e) => update({ field: e.target.value, value: defaultConditionValue(otherElements.find((x) => x.name === e.target.value)) })}>
        {otherElements.map((el) => <option key={el.name} value={el.name}>{el.label || el.name}</option>)}
      </select>
      <select value={op} onChange={(e) => update({ op: e.target.value })}>
        {OPERATORS.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
      </select>
      <ConditionValueInput sourceElement={sourceElement} value={value} onChange={(v) => update({ value: v })} />
    </div>
  );
}

function ConditionValueInput({ sourceElement, value, onChange }) {
  if (sourceElement?.type === 'checkbox') {
    return (
      <select value={String(value)} onChange={(e) => onChange(e.target.value === 'true')}>
        <option value="true">да</option>
        <option value="false">нет</option>
      </select>
    );
  }
  if ((sourceElement?.type === 'select' || sourceElement?.type === 'radio') && sourceElement.options?.length) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {sourceElement.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (sourceElement?.type === 'number') {
    return <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />;
  }
  return <input value={value} onChange={(e) => onChange(e.target.value)} />;
}
