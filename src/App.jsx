import { useState } from 'react';
import FormRenderer from './components/FormRenderer.jsx';
import { validateSpec } from './core/validateSpec.js';
import { validateValue } from './core/validateValue.js';

// Начальная версия: только ввод текстом (файл/API — следующие этапы),
// только 4 базовых типа полей, без data binding, без array/matrix/list.
export default function App() {
  const [text, setText] = useState('');
  const [spec, setSpec] = useState(null);
  const [specErrors, setSpecErrors] = useState([]);
  const [values, setValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [collected, setCollected] = useState(null);

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

  const handleLoadFromText = (raw) => {
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
      setSpec(parsed);
      setValues({});
      setFieldErrors({});
    } else {
      setSpec(null);
    }
  };

  const handleLoad = () => handleLoadFromText(text);

  const handleFieldChange = (name, value) => {
    const element = spec.elements.find((el) => el.name === name);
    const message = validateValue(element, value);
    setFieldErrors((prev) => ({ ...prev, [name]: message }));
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleCollect = () => {
    const errors = {};
    spec.elements.forEach((el) => {
      const message = validateValue(el, values[el.name]);
      if (message) errors[el.name] = message;
    });
    setFieldErrors(errors);
    setCollected(Object.keys(errors).length === 0 ? values : null);
  };

  return (
    <div className="app">
      <h1>JSON GUI Builder (начальная версия)</h1>
      <div className="app-columns">
        <section>
          <label htmlFor="spec-text">JSON-спецификация</label>
          <textarea
            id="spec-text"
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{"title": "...", "elements": [...]}'
          />
          <button type="button" onClick={handleLoad}>Загрузить спецификацию</button>
          <label className="file-button">
            Загрузить файл .json
            <input type="file" accept=".json" onChange={handleFile} hidden />
          </label>

          {specErrors.length > 0 && (
            <div className="error-list">
              <p>Спецификация некорректна:</p>
              <ul>
                {specErrors.map((e, i) => <li key={i}><code>{e.path}</code> — {e.message}</li>)}
              </ul>
            </div>
          )}
        </section>

        <section>
          {spec && (
            <>
              <h2>{spec.title}</h2>
              <FormRenderer spec={spec} values={values} errors={fieldErrors} onFieldChange={handleFieldChange} />
              <button type="button" onClick={handleCollect}>Собрать данные</button>
              {collected && <pre className="output-json">{JSON.stringify(collected, null, 2)}</pre>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
