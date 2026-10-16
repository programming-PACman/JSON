import { useState } from 'react';
import { UI_STRINGS } from '../core/i18n.js';
import {
  LOCALES, allKeys, setEntry, removeKey, isValidKey, findMissingKeys,
  parseDictionary, serializeDictionary, mergeDictionaries,
} from '../core/dictionary.js';

// Форма пополнения общего словаря + таблица существующих записей.
// spec нужен только для подсказки «каких ключей формы не хватает».
export default function DictionaryPanel({ dictionary, spec, locale, onChange }) {
  const t = UI_STRINGS[locale];
  const [draftKey, setDraftKey] = useState('');
  const [draftTexts, setDraftTexts] = useState({});
  const [message, setMessage] = useState('');

  const keys = allKeys(dictionary);
  const missing = spec ? findMissingKeys(spec, dictionary, locale) : [];

  const handleAdd = () => {
    if (!isValidKey(draftKey)) { setMessage(t.dictInvalidKey); return; }
    if (keys.includes(draftKey)) { setMessage(t.dictDuplicateKey); return; }
    if (!LOCALES.some((l) => (draftTexts[l] || '').trim())) { setMessage(t.dictNeedText); return; }
    let next = dictionary;
    LOCALES.forEach((l) => { next = setEntry(next, draftKey, l, (draftTexts[l] || '').trim()); });
    onChange(next);
    setDraftKey('');
    setDraftTexts({});
    setMessage('');
  };

  const handleExport = () => {
    const blob = new Blob([serializeDictionary(dictionary)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dictionary.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseDictionary(reader.result);
      if (result.error) { setMessage(`${t.dictImportError}: ${result.error}`); return; }
      onChange(mergeDictionaries(dictionary, result.dict));
      setMessage('');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="dictionary-panel">
      <p className="dictionary-hint">{t.dictHint}</p>

      {spec && (
        <p className={missing.length ? 'dictionary-missing' : 'dictionary-ok'}>
          {missing.length ? t.dictMissing(missing.length) : t.dictAllTranslated}
          {missing.map((k) => (
            <button key={k} type="button" className="secondary dictionary-chip" onClick={() => setDraftKey(k)}>{k}</button>
          ))}
        </p>
      )}

      <div className="dictionary-add">
        <input
          type="text"
          placeholder={t.dictKey}
          value={draftKey}
          onChange={(e) => setDraftKey(e.target.value)}
        />
        {LOCALES.map((l) => (
          <input
            key={l}
            type="text"
            placeholder={l.toUpperCase()}
            value={draftTexts[l] || ''}
            onChange={(e) => setDraftTexts((prev) => ({ ...prev, [l]: e.target.value }))}
          />
        ))}
        <button type="button" onClick={handleAdd}>{t.dictAdd}</button>
      </div>
      {message && <p className="dictionary-error">{message}</p>}

      {keys.length === 0 ? (
        <p className="dictionary-empty">{t.dictEmpty}</p>
      ) : (
        <table className="dictionary-table">
          <thead>
            <tr>
              <th>{t.dictKey}</th>
              {LOCALES.map((l) => <th key={l}>{l.toUpperCase()}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <td><code>{k}</code></td>
                {LOCALES.map((l) => (
                  <td key={l}>
                    <input
                      type="text"
                      value={dictionary?.[l]?.[k] ?? ''}
                      onChange={(e) => onChange(setEntry(dictionary, k, l, e.target.value))}
                    />
                  </td>
                ))}
                <td><button type="button" className="secondary" onClick={() => onChange(removeKey(dictionary, k))}>{t.dictDelete}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="dictionary-io">
        <button type="button" className="secondary" onClick={handleExport}>{t.dictExport}</button>
        <label className="file-button">
          {t.dictImport}
          <input type="file" accept=".json" onChange={handleImport} hidden />
        </label>
      </div>
    </div>
  );
}
