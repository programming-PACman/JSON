// Клиент REST API. Любая сетевая ошибка/таймаут превращается в ApiError с status 0 —
// вызывающий код различает «сервер недоступен» (status 0) и «сервер отказал» (4xx/5xx).
export class ApiError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

const TIMEOUT_MS = 5000;

async function request(method, url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new ApiError(0, e.name === 'AbortError' ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try { const text = await res.text(); data = text ? JSON.parse(text) : null; } catch { /* не JSON — оставляем null */ }
  if (!res.ok) throw new ApiError(res.status, data?.error || `HTTP ${res.status}`, data?.errors);
  return data;
}

export const api = {
  getDictionary: () => request('GET', '/api/dictionary'),
  putEntry: (key, texts) => request('PUT', `/api/dictionary/entries/${encodeURIComponent(key)}`, texts),
  deleteEntry: (key) => request('DELETE', `/api/dictionary/entries/${encodeURIComponent(key)}`),
  mergeDictionary: (dict) => request('POST', '/api/dictionary/merge', dict),
  saveSpec: (spec) => request('POST', '/api/spec', spec),
  updateSpec: (id, spec) => request('PUT', `/api/spec/${id}`, spec),
  getSpec: (id) => request('GET', `/api/spec/${id}`),
  listSpecs: () => request('GET', '/api/specs'),
};
