import { useState, useEffect } from 'react';
import FormRenderer from './components/FormRenderer.jsx';
import { validateSpec } from './core/validateSpec.js';
import {
  validateValue, validateArrayItems, validateMatrixRows, validateListRows,
  hasAnyArrayError, hasAnyMatrixError, hasAnyListError,
} from './core/validateValue.js';
import { UI_STRINGS, resolveText } from './core/i18n.js';
import { buildDependencyGraph, propagateChange, computeInitialState } from './core/bindingEngine.js';
import BuilderPanel from './builder/BuilderPanel.jsx';
import DictionaryPanel from './builder/DictionaryPanel.jsx';
import JsonTools from './builder/JsonTools.jsx';
import SpecInputPanel from './components/SpecInputPanel.jsx';
import { loadDictionary, saveDictionary, withSharedDictionary, allKeys } from './core/dictionary.js';

function validateElement(el, value, locale, label) {
  if (el.type === 'array') return validateArrayItems(el, value, locale);
  if (el.type === 'matrix') return validateMatrixRows(el, value, locale);
  if (el.type === 'list') return validateListRows(el, value, locale);
  return validateValue(el, value, locale, label);
}

function hasError(el, message) {
  if (el.type === 'array') return hasAnyArrayError(message);
  if (el.type === 'matrix') return hasAnyMatrixError(message);
  if (el.type === 'list') return hasAnyListError(message);
  return Boolean(message);
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
  const [mode, setMode] = useState('json'); // 'json' | 'builder' | 'preview' | 'dictionary'
  const [dictionary, setDictionary] = useState(() => loadDictionary());
  const [builderSpec, setBuilderSpec] = useState({ title: 'Новая форма', elements: [] });

  const t = UI_STRINGS[locale];

  useEffect(() => { saveDictionary(dictionary); }, [dictionary]);

  // spec с переводами, слитыми с общим словарём (локальные translations приоритетнее)
  const effectiveSpec = withSharedDictionary(spec, dictionary);

  const handleLoadFromText = (raw) => {
    setCheckedOk(false);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setSpecErrors([{ path: '$', message: UI_STRINGS[locale].invalidJson(e.message) }]);
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

  // Конструктор меняет spec как объект — каждое изменение сразу сериализуется
  // в text (чтобы режим "JSON" показывал актуальный результат при переключении)
  // и сразу прогоняется через обычный конвейер загрузки, чтобы превью справа
  // обновлялось вживую по мере редактирования, а не только по кнопке.
  const handleBuilderChange = (newSpec) => {
    setBuilderSpec(newSpec);
    const json = JSON.stringify(newSpec, null, 2);
    setText(json);
    handleLoadFromText(json);
  };

  const switchToBuilder = () => {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.elements)) setBuilderSpec(parsed);
    } catch {
      // некорректный JSON — оставляем builderSpec как был, не теряем прогресс конструктора
    }
    setMode('builder');
  };

  // Импорт готовой спецификации из файла: сразу в конструктор (чтобы продолжить
  // визуальное редактирование) и через обычный конвейер validateSpec → превью.
  // Спецификация с ошибками тоже загружается — ошибки видны в списке и значках,
  // и их можно исправить визуально. Не-спецификация (нет массива elements) отклоняется.
  const handleImport = (raw) => {
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return false; }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.elements)) return false;
    setBuilderSpec(parsed);
    setText(raw);
    handleLoadFromText(raw);
    return true;
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

  const handleCheck = () => {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setSpecErrors([{ path: '$', message: UI_STRINGS[locale].invalidJson(e.message) }]);
      setCheckedOk(false);
      return;
    }
    const errors = validateSpec(parsed);
    setSpecErrors(errors);
    setCheckedOk(errors.length === 0);
  };

  const handleClear = () => {
    if (!spec || !graph) return;
    const initial = computeInitialState(spec.elements, graph);
    setValues(initial.values);
    setDynamicOptions(initial.dynamicOptions);
    setVisibility(initial.visibility);
    setFieldErrors({});
    setCollected(null);
  };

  const resolvedLabel = (element) => resolveText(element, 'label', locale, effectiveSpec?.translations) ?? element.label;

  const handleFieldChange = (name, value) => {
    const element = spec.elements.find((el) => el.name === name);
    const message = validateElement(element, value, locale, resolvedLabel(element));
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
      const message = validateElement(el, values[el.name], locale, resolvedLabel(el));
      if (hasError(el, message)) errors[el.name] = message;
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

      <div className={`app-columns${mode === 'preview' ? ' preview-only' : ''}`}>
        <section>
          <div className="mode-switch">
            <button type="button" className={mode === 'json' ? 'active' : 'secondary'} onClick={() => setMode('json')}>JSON</button>
            <button type="button" className={mode === 'builder' ? 'active' : 'secondary'} onClick={switchToBuilder}>{t.builderTab}</button>
            <button type="button" className={mode === 'preview' ? 'active' : 'secondary'} onClick={() => setMode('preview')}>{t.previewTab}</button>
            <button type="button" className={mode === 'dictionary' ? 'active' : 'secondary'} onClick={() => setMode('dictionary')}>{t.dictTab}</button>
          </div>

          {mode === 'json' && (
            <>
              <SpecInputPanel text={text} onTextChange={setText} onLoad={handleLoad} onCheck={handleCheck} onFile={handleFile} locale={locale} />
              <JsonTools getText={() => text} onImport={handleImport} locale={locale} filename={spec?.title} showImport={false} />
            </>
          )}
          {mode === 'builder' && (
            <>
              <JsonTools getText={() => JSON.stringify(builderSpec, null, 2)} onImport={handleImport} locale={locale} filename={builderSpec.title} />
              <BuilderPanel spec={builderSpec} errors={specErrors} onChange={handleBuilderChange} dictionaryKeys={allKeys(dictionary)} />
            </>
          )}
          {mode === 'dictionary' && (
            <DictionaryPanel dictionary={dictionary} spec={spec} locale={locale} onChange={setDictionary} />
          )}

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

        <section className="preview-column">
          {spec && (
            <>
              <h2>{resolveText(spec, 'title', locale, effectiveSpec.translations) ?? spec.title}</h2>
              <FormRenderer spec={effectiveSpec} values={values} errors={fieldErrors} locale={locale} dynamicOptions={dynamicOptions} visibility={visibility} onFieldChange={handleFieldChange} />
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
