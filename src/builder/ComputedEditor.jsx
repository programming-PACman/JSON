import { expressionProblem, appendToExpression, OPERATOR_CHIPS } from './builderUtils.js';

// Выражение для bind.computed. Пользователь не обязан помнить имена полей:
// кнопки-«фишки» вставляют имя поля или оператор в конец выражения.
// Ошибки (синтаксис, неизвестное поле) показываются сразу, не дожидаясь
// общего списка ошибок спецификации.
export default function ComputedEditor({ expression, sources, onChange }) {
  const names = sources.map((s) => s.name);
  const problem = expressionProblem(expression, names);
  return (
    <div className="computed-editor">
      <input
        placeholder={names.length ? `например: ${names[0]} * 2` : 'выражение'}
        value={expression ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
      {problem && <p className="field-error">{problem}</p>}
      <div className="computed-chips">
        {sources.map((s) => (
          <button key={s.name} type="button" className="secondary chip" title={s.label} onClick={() => onChange(appendToExpression(expression, s.name))}>{s.name}</button>
        ))}
        {OPERATOR_CHIPS.map((op) => (
          <button key={op} type="button" className="secondary chip chip-op" onClick={() => onChange(appendToExpression(expression, op))}>{op}</button>
        ))}
      </div>
    </div>
  );
}
