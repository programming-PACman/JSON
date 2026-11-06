import { useState, useEffect } from 'react';
import { api, ApiError } from '../core/api.js';
import { UI_STRINGS } from '../core/i18n.js';

// Сохранение формы на сервер и открытие сохранённых форм.
// getText() отдаёт актуальный JSON; onImport(raw) загружает его в конструктор/превью.
export default function ServerTools({ getText, onImport, locale }) {
  const t = UI_STRINGS[locale];
  const [currentId, setCurrentId] = useState(null);
  const [list, setList] = useState([]);
  const [message, setMessage] = useState(null); // { kind: 'ok' | 'error', text }

  const reloadList = async () => {
    try { setList(await api.listSpecs()); } catch { setList([]); }
  };
  useEffect(() => { reloadList(); }, []);

  const explain = (e) => {
    if (e instanceof ApiError && e.status === 0) return t.srvOffline;
    if (e instanceof ApiError && e.status === 422) return t.srvInvalid((e.details || []).length);
    if (e instanceof ApiError && e.status === 404) return t.srvNotFound;
    return e?.message || String(e);
  };

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
    if (!id) return;
    try {
      const rec = await api.getSpec(id);
      if (onImport(JSON.stringify(rec.spec, null, 2))) {
        setCurrentId(rec.id);
        setMessage({ kind: 'ok', text: t.srvLoaded(rec.id) });
      }
    } catch (e) { setMessage({ kind: 'error', text: explain(e) }); }
  };

  return (
    <div className="server-tools">
      <div className="server-tools-row">
        <button type="button" onClick={() => save(false)}>{currentId ? t.srvUpdate : t.srvSave}</button>
        {currentId && <button type="button" className="secondary" onClick={() => save(true)}>{t.srvSaveNew}</button>}
        <select value="" aria-label={t.srvList} onFocus={reloadList} onChange={(e) => open(e.target.value)}>
          <option value="">{t.srvPick}</option>
          {list.map((s) => <option key={s.id} value={s.id}>{s.title || t.srvUntitled} · {s.id}</option>)}
        </select>
      </div>
      {message && <p className={message.kind === 'ok' ? 'server-ok' : 'server-error'}>{message.text}</p>}
    </div>
  );
}
