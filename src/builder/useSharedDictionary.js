import { useState, useEffect, useRef, useCallback } from 'react';
import { api, ApiError } from '../core/api.js';
import { loadDictionary, saveDictionary, diffDictionary, applyOps, normalizeDictionary, allKeys } from '../core/dictionary.js';

const DEBOUNCE_MS = 500; // правки в таблице копятся и уходят на сервер одним пакетом
const RETRY_MS = 5000;   // повтор при недоступном сервере

// Общий словарь: хранится на сервере, локальная копия в localStorage — запасной вариант (офлайн).
// Состояния status.state: connecting | synced | saving | offline | error.
// Принцип: на сервер уходят не «весь словарь целиком», а операции над отдельными ключами
// (diffDictionary), а ответ сервера накладывается обратно с сохранением ещё не отправленных
// правок (applyOps) — поэтому чужие изменения не затираются и свои не теряются.
export function useSharedDictionary() {
  const [dictionary, setDictionaryState] = useState(() => loadDictionary());
  const [status, setStatus] = useState({ state: 'connecting' });
  const initial = useRef(dictionary);  // что было в localStorage при запуске
  const latest = useRef(dictionary);   // актуальный словарь (включая неотправленные правки)
  const synced = useRef(null);         // последнее известное состояние сервера (null — ещё не знаем)
  const timer = useRef(null);
  const flushing = useRef(false);
  const fns = useRef({});

  const commit = (d) => { latest.current = d; setDictionaryState(d); saveDictionary(d); };
  const schedule = (ms) => { clearTimeout(timer.current); timer.current = setTimeout(() => fns.current.flush(), ms); };

  const fail = (e) => {
    if (e instanceof ApiError && e.status === 0) { setStatus({ state: 'offline' }); schedule(RETRY_MS); }
    else setStatus({ state: 'error', message: e?.message || String(e) });
  };

  // Накладывает свежее состояние сервера, сохраняя правки, сделанные после synced.
  const adopt = (raw) => {
    const server = normalizeDictionary(raw);
    const pending = diffDictionary(synced.current, latest.current);
    synced.current = server;
    commit(applyOps(server, pending));
    if (pending.length) { setStatus({ state: 'saving' }); schedule(DEBOUNCE_MS); } else setStatus({ state: 'synced' });
  };

  // Первое подключение: сервер главнее, но ключи, которых на сервере ещё нет
  // (например, накопленные локально до появления сервера), поднимаются на него.
  const connect = async () => {
    try {
      const server = normalizeDictionary(await api.getDictionary());
      const known = new Set(allKeys(server));
      const migrate = diffDictionary(server, initial.current).filter((op) => op.type === 'put' && !known.has(op.key));
      // правки, которые пользователь успел сделать, пока шло подключение
      const edits = diffDictionary(initial.current, latest.current);
      initial.current = latest.current = applyOps(applyOps(server, migrate), edits);
      synced.current = server;
      commit(latest.current);
      if (diffDictionary(server, latest.current).length) { setStatus({ state: 'saving' }); schedule(0); } else setStatus({ state: 'synced' });
    } catch (e) { fail(e); }
  };

  const flush = async () => {
    if (flushing.current) { schedule(DEBOUNCE_MS); return; }
    if (synced.current === null) { await connect(); return; }
    const snapshot = latest.current;
    const ops = diffDictionary(synced.current, snapshot);
    if (!ops.length) { setStatus({ state: 'synced' }); return; }
    flushing.current = true;
    setStatus({ state: 'saving' });
    try {
      let last = null;
      for (const op of ops) last = op.type === 'put' ? await api.putEntry(op.key, op.texts) : await api.deleteEntry(op.key);
      synced.current = snapshot; // сервер теперь равен snapshot; всё, что изменилось позже, — «неотправленное»
      adopt(last);
    } catch (e) { fail(e); } finally { flushing.current = false; }
  };

  const refresh = async () => {
    if (flushing.current) return;
    if (synced.current === null) { await connect(); return; }
    try { adopt(await api.getDictionary()); } catch (e) { fail(e); }
  };

  fns.current = { flush, refresh };

  useEffect(() => {
    connect();
    const onFocus = () => { if (!timer.current && !flushing.current) fns.current.refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { clearTimeout(timer.current); window.removeEventListener('focus', onFocus); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDictionary = useCallback((next) => {
    commit(next);
    setStatus((s) => (s.state === 'connecting' || s.state === 'offline' ? s : { state: 'saving' }));
    schedule(DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { dictionary, setDictionary, status, refresh: () => fns.current.refresh() };
}
