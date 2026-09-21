import { useState } from 'react';
import FormRenderer from './components/FormRenderer.jsx';
import { validateSpec } from './core/validateSpec.js';
import { validateValue, validateArrayItems, validateMatrixRows, hasAnyArrayError, hasAnyMatrixError } from './core/validateValue.js';
import { UI_STRINGS, resolveText } from './core/i18n.js';
import { buildDependencyGraph, propagateChange } from './core/bindingEngine.js';

function computeInitialState(elements, graph) {
  let values = {};
  elements.forEach((el) => { if (el.default !== undefined) values[el.name] = el.default; });
  let dynamicOptions = {}, visibility = {};
  Object.keys(graph.dependents).forEach((sourceName) => {
    if (values[sourceName] === undefined) return;
    const r = propagateChange(sourceName, graph, values);
    values = r.values;
    dynamicOptions = { ...dynamicOptions, ...r.dynamicOptions };
    visibility = { ...visibility, ...r.visibility };
  });
  return { values, dynamicOptions, visibility };
}

export default function App() {
  const [locale, setLocale] = useState('ru');
  const [text, setText] = useState('');
  const [spec, setSpec] = useState(null);
  const [graph, setGraph] = useState(null);
  const [specErrors, setSpecErrors] = useState([]);
  const [values, setValues] = useState({});
  const [dynamicOptions, setDynamicOptions] = useState({});
  const [visibility, setVisibility] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [collected, setCollected] = useState(null);
  const [checkedOk, setCheckedOk] = useState(false);

  const t = UI_STRINGS[locale];

  const handleLoadFromText = (raw) => {
    setCheckedOk(false);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setSpecErrors([{ path: '$', message: `Некорректный JSON: ${e.message}` }]);
      setSpec(null);
      return;
    }

    const errors = validateSpec(parsed);
    setSpecErrors(errors);
    setCollected(null);

    if (errors.length === 0) {
      const newGraph = buildDependencyGraph(parsed.elements);
      const initial = computeInitialState(parsed.elements, newGraph);
      setSpec(parsed);
      setGraph(newGraph);
      setValues(initial.values);
      setDynamicOptions(initial.dynamicOptions);
      setVisibility(initial.visibility);
      setFieldErrors({});
    } else {
      setSpec(null);
    }
  };

  const handleLoad = () => handleLoadFromText(text);

  // "Проверить" — ТОЛЬКО валидация текста, без перестройки уже открытой формы.
  // Полезно, когда правишь JSON во время заполнения формы и не хочешь
  // потерять уже введённые значения ради проверки синтаксиса.
  const handleCheck = () => {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setSpecErrors([{ path: '$', message: `Некорректный JSON: ${e.message}` }]);
      setCheckedOk(false);
      return;
    }
    const errors = validateSpec(parsed);
    setSpecErrors(errors);
    setCheckedOk(errors.length === 0);
  };

  // "Очистить форму" — сбрасывает введённые значения к default'ам спецификации,
  // НЕ трогая саму спецификацию (в отличие от повторной загрузки).
  const handleClear = () => {
    if (!spec || !graph) return;
    const initial = computeInitialState(spec.elements, graph);
    setValues(initial.values);
    setDynamicOptions(initial.dynamicOptions);
    setVisibility(initial.visibility);
    setFieldErrors({});
    setCollected(null);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(reader.result);
      handleLoadFromText(reader.result);
    };
    reader.readAsText(file);
  };

  const resolvedLabel = (element) => resolveText(element, 'label', locale, spec?.translations) ?? element.label;

  const handleFieldChange = (name, value) => {
    const element = spec.elements.find((el) => el.name === name);
    let message;
    if (element.type === 'array') message = validateArrayItems(element, value, locale);
    else if (element.type === 'matrix') message = validateMatrixRows(element, value, locale);
    else message = validateValue(element, value, locale, resolvedLabel(element));
    setFieldErrors((prev) => ({ ...prev, [name]: message }));

    const updated = { ...values, [name]: value };
    const r = propagateChange(name, graph, updated);
    setValues(r.values);
    setDynamicOptions((prev) => ({ ...prev, ...r.dynamicOptions }));
    setVisibility((prev) => ({ ...prev, ...r.visibility }));
  };

  const handleCollect = () => {
    const errors = {};
    spec.elements.forEach((el) => {
      if (visibility[el.name] === false) return;
      if (el.type === 'array') {
        const itemErrors = validateArrayItems(el, values[el.name] || [], locale);
        if (hasAnyArrayError(itemErrors)) errors[el.name] = itemErrors;
      } else if (el.type === 'matrix') {
        const rowErrors = validateMatrixRows(el, values[el.name] || [], locale);
        if (hasAnyMatrixError(rowErrors)) errors[el.name] = rowErrors;
      } else {
        const message = validateValue(el, values[el.name], locale, resolvedLabel(el));
        if (message) errors[el.name] = message;
      }
    });
    setFieldErrors(errors);
    setCollected(Object.keys(errors).length === 0 ? values : null);
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1>{t.appTitle}</h1>
        <button type="button" className="lang-switch" onClick={() => setLocale(locale === 'ru' ? 'en' : 'ru')}>
          {locale === 'ru' ? 'EN' : 'RU'}
        </button>
      </div>

      <div className="app-columns">
        <section>
          <label htmlFor="spec-text">{t.specLabel}</label>
          <textarea
            id="spec-text"
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{"title": "...", "elements": [...]}'
          />
          <button type="button" onClick={handleLoad}>{t.loadButton}</button>
          <button type="button" onClick={handleCheck}>{t.checkButton}</button>
          <label className="file-button">
            {t.fileButton}
            <input type="file" accept=".json" onChange={handleFile} hidden />
          </label>

          {checkedOk && specErrors.length === 0 && <p className="check-ok">{t.checkOk}</p>}

          {specErrors.length > 0 && (
            <div className="error-list">
              <p>{t.invalidSpec}</p>
              <ul>
                {specErrors.map((e, i) => <li key={i}><code>{e.path}</code> — {e.message}</li>)}
              </ul>
            </div>
          )}
        </section>

        <section>
          {spec && (
            <>
              <h2>{resolveText(spec, 'title', locale, spec.translations) ?? spec.title}</h2>
              <FormRenderer spec={spec} values={values} errors={fieldErrors} locale={locale} dynamicOptions={dynamicOptions} visibility={visibility} onFieldChange={handleFieldChange} />
              <button type="button" onClick={handleCollect}>{t.collectButton}</button>
              <button type="button" onClick={handleClear}>{t.clearButton}</button>
              {collected && <pre className="output-json">{JSON.stringify(collected, null, 2)}</pre>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
