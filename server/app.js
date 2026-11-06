// REST API без внешних зависимостей (node:http). createApp({dataDir}) возвращает
// обработчик (req, res) — его можно повесить на http.createServer или вызывать в тестах.
import { validateSpec } from '../src/core/validateSpec.js';
import { LOCALES, isValidKey, normalizeDictionary, mergeDictionaries } from '../src/core/dictionary.js';
import { createStorage } from './storage.js';

const MAX_BODY = 1024 * 1024; // 1 МБ

class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'Тело запроса больше 1 МБ')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw.trim()) throw new HttpError(400, 'Пустое тело запроса');
  try { return JSON.parse(raw); } catch (e) { throw new HttpError(400, `Некорректный JSON: ${e.message}`); }
}

function send(res, status, body) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

const isSpecLike = (x) => x && typeof x === 'object' && !Array.isArray(x);

export async function createApp({ dataDir }) {
  const storage = await createStorage(dataDir);

  async function route(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean); // ['api', 'spec', id]
    const m = req.method;
    if (parts[0] !== 'api') throw new HttpError(404, 'Не найдено');

    if (parts[1] === 'health' && m === 'GET') return send(res, 200, { status: 'ok' });

    if (parts[1] === 'validate' && m === 'POST') {
      const spec = await readJson(req);
      const errors = validateSpec(spec);
      return send(res, 200, { valid: errors.length === 0, errors });
    }

    if (parts[1] === 'specs' && m === 'GET') return send(res, 200, await storage.listSpecs());

    if (parts[1] === 'spec') {
      if (parts.length === 2 && m === 'POST') {
        const spec = await readJson(req);
        const errors = isSpecLike(spec) ? validateSpec(spec) : [{ path: '$', message: 'Спецификация должна быть объектом' }];
        if (errors.length) throw new HttpError(422, 'Спецификация некорректна', { errors });
        const rec = await storage.saveSpec(spec);
        return send(res, 201, { id: rec.id, url: `/api/spec/${rec.id}` });
      }
      if (parts.length === 3) {
        const id = parts[2];
        if (m === 'GET') {
          const rec = await storage.getSpec(id);
          if (!rec) throw new HttpError(404, 'Спецификация не найдена');
          return send(res, 200, rec);
        }
        if (m === 'PUT') {
          const spec = await readJson(req);
          const errors = isSpecLike(spec) ? validateSpec(spec) : [{ path: '$', message: 'Спецификация должна быть объектом' }];
          if (errors.length) throw new HttpError(422, 'Спецификация некорректна', { errors });
          const rec = await storage.updateSpec(id, spec);
          if (!rec) throw new HttpError(404, 'Спецификация не найдена');
          return send(res, 200, rec);
        }
        if (m === 'DELETE') {
          if (!(await storage.deleteSpec(id))) throw new HttpError(404, 'Спецификация не найдена');
          return send(res, 204);
        }
      }
    }

    if (parts[1] === 'dictionary') {
      if (parts.length === 2 && m === 'GET') return send(res, 200, normalizeDictionary(await storage.getDictionary()));

      if (parts[2] === 'merge' && parts.length === 3 && m === 'POST') {
        const incoming = normalizeDictionary(await readJson(req));
        return send(res, 200, await storage.updateDictionary((cur) => mergeDictionaries(normalizeDictionary(cur), incoming)));
      }

      if (parts[2] === 'entries' && parts.length === 4) {
        const key = decodeURIComponent(parts[3]);
        if (!isValidKey(key)) throw new HttpError(400, 'Некорректный ключ: латиница, цифры и _, не с цифры');

        if (m === 'PUT') {
          const body = await readJson(req);
          if (!isSpecLike(body)) throw new HttpError(400, 'Ожидается объект вида {"ru": "...", "en": "..."}');
          const texts = {};
          for (const [l, v] of Object.entries(body)) {
            if (!LOCALES.includes(l)) throw new HttpError(400, `Неизвестный язык: ${l}`);
            if (typeof v !== 'string') throw new HttpError(400, `Перевод "${l}" должен быть строкой`);
            texts[l] = v;
          }
          if (!Object.keys(texts).length) throw new HttpError(400, 'Укажите перевод хотя бы для одного языка');
          const dict = await storage.updateDictionary((cur) => {
            const next = normalizeDictionary(cur);
            for (const [l, v] of Object.entries(texts)) {
              next[l] = { ...next[l] };
              if (v === '') delete next[l][key]; else next[l][key] = v; // пустая строка = удалить перевод
            }
            return next;
          });
          return send(res, 200, dict);
        }
        if (m === 'DELETE') {
          const dict = await storage.updateDictionary((cur) => {
            const next = normalizeDictionary(cur);
            Object.keys(next).forEach((l) => { next[l] = { ...next[l] }; delete next[l][key]; });
            return next;
          });
          return send(res, 200, dict);
        }
      }
    }

    throw new HttpError(404, 'Не найдено');
  }

  return async function handler(req, res) {
    try {
      await route(req, res);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...(e.extra || {}) });
      console.error(e);
      send(res, 500, { error: 'Внутренняя ошибка сервера' });
    }
  };
}
