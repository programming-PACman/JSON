// Рендерит форму по спецификации. Пока поддерживает 4 базовых типа
// (text, number, select, checkbox) без data binding, без array/matrix/list —
// это будет добавляться на следующих этапах разработки.
export default function FormRenderer({ spec, values, errors, onFieldChange }) {
  return (
    <div className="form-renderer">
      {spec.elements.map((element) => (
        <Field
          key={element.name}
          element={element}
          value={values[element.name]}
          error={errors[element.name]}
          onChange={(v) => onFieldChange(element.name, v)}
        />
      ))}
    </div>
  );
}

function Field({ element, value, error, onChange }) {
  const label = (
    <label htmlFor={element.name}>
      {element.label}{element.required && <span className="required">*</span>}
    </label>
  );

  let input;
  if (element.type === 'select') {
    input = (
      <select id={element.name} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>Выберите значение</option>
        {element.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  } else if (element.type === 'radio') {
    return (
      <div className="field">
        <span>{element.label}{element.required && <span className="required">*</span>}</span>
        {element.options.map((opt) => (
          <label key={opt.value} className="radio-option">
            <input
              type="radio"
              name={element.name}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            {opt.label}
          </label>
        ))}
        {error && <p className="field-error">{error}</p>}
      </div>
    );
  } else if (element.type === 'checkbox') {
    return (
      <div className="field field-inline">
        <label>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {' '}{element.label}
        </label>
        {error && <p className="field-error">{error}</p>}
      </div>
    );
  } else if (element.type === 'textarea') {
    input = <textarea id={element.name} rows={4} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  } else {
    const inputType = element.type === 'number' ? 'number' : element.type === 'email' ? 'email' : element.type === 'date' ? 'date' : 'text';
    input = (
      <input
        id={element.name}
        type={inputType}
        value={value ?? ''}
        onChange={(e) => onChange(element.type === 'number' ? Number(e.target.value) : e.target.value)}
      />
    );
  }

  return (
    <div className="field">
      {label}
      {input}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
