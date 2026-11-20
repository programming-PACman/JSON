import { useState, useEffect } from 'react';
import { api, ApiError } from '../core/api.js';
import { UI_STRINGS } from '../core/i18n.js';

// Сохранение формы на сервер и список сохранённых форм (виден всем; открыть форму может любой).
// getText() отдаёт актуальный JSON; onImport(raw) загружает его в конструктор/превью.
// Ошибки списка и открытия показываются на экране — раньше сбой молча давал пустой список.
export default function ServerTools({ getText, onImport, locale, canSave = true, reloadKey }) {
  const t = UI_STRINGS[locale];
  const [currentId, setCurrentId] = useState(null);
  const [list, setList] = useState(null); // null — ещё не загружен
  const [listError, setListError] = useState('');
  const [message, setMessage] = useState(null); // { kind: 'ok' | 'error', text }

  const explain = (e) => {
    if (e instanceof ApiError && e.status === 0) return t.srvOffline;
    if (e instanceof ApiError && e.status === 422) return t.srvInvalid((e.details || []).length);
    if (e instanceof ApiError && e.status === 404) return t.srvNotFound;
    if (e instanceof ApiError && e.status === 401) return t.srvAuth;
    if (e instanceof ApiError && e.status === 403) return t.srvForbidden;
    return e?.message || String(e);
  };

  const reloadList = async () => {
    try { setList(await api.listSpecs()); setListError(''); } catch (e) { setListError(t.srvListFailed(explain(e))); }
  };
  // перезагружаем при входе/выходе (reloadKey) — список и права могут измениться
  useEffect(() => { reloadList(); }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (asNew) => {
    let spec;
    try { spec = JSON.parse(getText()); } catch (e) { setMessage({ kind: 'error', text: t.invalidJson(e.message) }); return; }
    try {
      if (currentId && !asNew) {
        await api.updateSpec(currentId, spec);
        setMessage({ kind: 'ok', text: t.srvUpdated(currentId) });
      } else {
        const { id } = await api.saveSpec(spec);
        setCurrentId(id);
        setMessage({ kind: 'ok', text: t.srvSaved(id) });
      }
      reloadList();
    } catch (e) { setMessage({ kind: 'error', text: explain(e) }); }
  };

  const open = async (id) => {
    try {
      const rec = await api.getSpec(id);
      if (onImport(JSON.stringify(rec.spec, null, 2))) {
        setCurrentId(rec.id);
        setMessage({ kind: 'ok', text: t.srvLoaded(rec.id) });
      } else {
        setMessage({ kind: 'error', text: t.srvOpenFailed });
      }
    } catch (e) { setMessage({ kind: 'error', text: explain(e) }); }
  };

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-GB') : '');

  return (
    <div className="server-tools">
      <div className="server-tools-row">
        <button type="button" disabled={!canSave} onClick={() => save(false)}>{currentId ? t.srvUpdate : t.srvSave}</button>
        {currentId && <button type="button" className="secondary" disabled={!canSave} onClick={() => save(true)}>{t.srvSaveNew}</button>}
        <button type="button" className="secondary" onClick={reloadList}>{t.srvRefreshList}</button>
      </div>
      {!canSave && <p className="server-hint">{t.srvAuth}</p>}
      {message && <p className={message.kind === 'ok' ? 'server-ok' : 'server-error'}>{message.text}</p>}
      {listError && <p className="server-error" role="alert">{listError}</p>}

      <h3 className="server-list-title">{t.srvList}</h3>
      {list && list.length === 0 && !listError && <p className="server-empty">{t.srvListEmpty}</p>}
      {list && list.length > 0 && (
        <div className="server-list">
          <table className="dictionary-table" aria-label={t.srvList}>
            <thead><tr><th>{t.srvList}</th><th>{t.srvOwner}</th><th>{t.srvUpdatedAt}</th><th /></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} data-spec-id={s.id}>
                  <td>{s.title || t.srvUntitled} <code>{s.id}</code></td>
                  <td>{s.owner || t.srvNoOwner}</td>
                  <td>{fmt(s.updatedAt)}</td>
                  <td><button type="button" className="secondary" onClick={() => open(s.id)}>{t.srvOpen}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
