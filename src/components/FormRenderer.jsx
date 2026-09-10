import { resolveText, UI_STRINGS } from '../core/i18n.js';

// Рендерит форму по спецификации. Пока поддерживает базовые типы,
// без data binding и без array/matrix/list — следующие этапы.
export default function FormRenderer({ spec, values, errors, locale, onFieldChange }) {
  return (
    <div className="form-renderer">
      {spec.elements.map((element) => (
        <Field
          key={element.name}
          element={element}
          value={values[element.name]}
          error={errors[element.name]}
          locale={locale}
          translations={spec.translations}
          onChange={(v) => onFieldChange(element.name, v)}
        />
      ))}
    </div>
  );
}

function Field({ element, value, error, locale, translations, onChange }) {
  const t = UI_STRINGS[locale] || UI_STRINGS.ru;
  const label = resolveText(element, 'label', locale, translations) ?? element.label;

  const resolveOption = (opt) => ({
    value: opt.value,
    label: resolveText(opt, 'label', locale, translations) ?? opt.label,
  });

  if (element.type === 'radio') {
    return (
      <div className="field">
        <span>{label}{element.required && <span className="required">*</span>}</span>
        {element.options.map(resolveOption).map((opt) => (
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
  }

  if (element.type === 'checkbox') {
    return (
      <div className="field field-inline">
        <label>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {' '}{label}
        </label>
        {error && <p className="field-error">{error}</p>}
      </div>
    );
  }

  let input;
  if (element.type === 'select') {
    input = (
      <select id={element.name} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>{t.selectPlaceholder}</option>
        {element.options.map(resolveOption).map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
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
      <label htmlFor={element.name}>{label}{element.required && <span className="required">*</span>}</label>
      {input}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
