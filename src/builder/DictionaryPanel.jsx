import { useState } from 'react';
import { UI_STRINGS } from '../core/i18n.js';
import {
  LOCALES, BASE_LOCALE, allKeys, setEntry, removeKey, renameKey, isValidKey, findMissingKeys,
  collectSpecKeys, parseDictionary, serializeDictionary, mergeDictionaries,
} from '../core/dictionary.js';

// Форма пополнения общего словаря + таблица существующих записей.
// spec нужен только для подсказки «каких ключей формы не хватает».
export default function DictionaryPanel({ dictionary, spec, locale, onChange, status, onRefresh }) {
  const t = UI_STRINGS[locale];
  const [draftKey, setDraftKey] = useState('');
  const [draftTexts, setDraftTexts] = useState({});
  const [message, setMessage] = useState('');
  const [renaming, setRenaming] = useState(null); // { from, to }

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

  const commitRename = () => {
    if (!renaming) return;
    const { from, to } = renaming;
    if (to === from) { setRenaming(null); return; }
    const result = renameKey(dictionary, from, to);
    if (result.error) { setMessage(result.error === 'duplicateKey' ? t.dictDuplicateKey : t.dictInvalidKey); return; }
    onChange(result.dict);
    setMessage(spec && collectSpecKeys(spec).includes(from) ? t.dictRenameWarn(from) : '');
    setRenaming(null);
  };

  const statusText = !status ? '' : {
    connecting: t.dictSyncConnecting,
    synced: t.dictSyncSynced,
    saving: t.dictSyncSaving,
    offline: t.dictSyncOffline,
    error: t.dictSyncError(status.message),
  }[status.state];

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
      {status && (
        <p className={`dictionary-sync sync-${status.state}`} data-sync={status.state}>
          {statusText}
          {onRefresh && <button type="button" className="secondary" onClick={onRefresh}>{t.dictRefresh}</button>}
        </p>
      )}

      {spec && (
        <p className={missing.length ? 'dictionary-missing' : 'dictionary-ok'}>
          {missing.length ? t.dictMissing(missing.length) : locale === BASE_LOCALE ? t.dictBaseLocale : t.dictAllTranslated}
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
                <td>
                  {renaming?.from === k ? (
                    <input
                      type="text"
                      autoFocus
                      aria-label={t.dictRename}
                      value={renaming.to}
                      onChange={(e) => setRenaming({ from: k, to: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
                      onBlur={commitRename}
                    />
                  ) : (
                    <>
                      <code>{k}</code>
                      <button type="button" className="secondary dictionary-rename" title={t.dictRename} aria-label={`${t.dictRename} ${k}`} onClick={() => setRenaming({ from: k, to: k })}>✎</button>
                    </>
                  )}
                </td>
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
