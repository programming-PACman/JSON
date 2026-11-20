// REST API без внешних зависимостей (node:http). createApp({dataDir}) возвращает
// обработчик (req, res) — его можно повесить на http.createServer или вызывать в тестах.
import { validateSpec } from '../src/core/validateSpec.js';
import { LOCALES, isValidKey, normalizeDictionary, mergeDictionaries } from '../src/core/dictionary.js';
import { createStorage, newId } from './storage.js';
import {
  SESSION_TTL_MS, COOKIE_NAME, USERNAME_RE, MIN_PASSWORD, MAX_PASSWORD, hashPassword, verifyPassword, verifyDummy,
  sessionKey, newSessionId, parseCookies, sessionCookie, createThrottle, publicUser,
} from './auth.js';

const ROLES = ['admin', 'editor'];
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

function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), ...headers });
  res.end(data);
}

const isSpecLike = (x) => x && typeof x === 'object' && !Array.isArray(x);

// Параметры:
//   requireAuth        — изменять формы и словарь могут только вошедшие пользователи (по умолчанию да);
//   Регистрация: пока в системе нет ни одного пользователя, любой может зарегистрироваться — он становится
//   администратором; после этого саморегистрация закрыта, новых пользователей создаёт только администратор.
//   secureCookie       — ставить cookie флаг Secure (включать за HTTPS).
export async function createApp({ dataDir, requireAuth = true, secureCookie = false, throttle = createThrottle() }) {
  const storage = await createStorage(dataDir);

  // Пользователь по cookie сессии (или null). Просроченные сессии считаются несуществующими.
  async function currentUser(req) {
    const sid = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!sid) return null;
    const session = (await storage.getSessions())[sessionKey(sid)];
    if (!session || session.expiresAt <= Date.now()) return null;
    return (await storage.getUsers()).find((u) => u.id === session.userId) || null;
  }

  async function startSession(res, user, status, body) {
    const sid = newSessionId();
    const now = Date.now();
    await storage.updateSessions((all) => {
      const next = {};
      Object.entries(all).forEach(([k, v]) => { if (v.expiresAt > now) next[k] = v; }); // заодно чистим просроченные
      next[sessionKey(sid)] = { userId: user.id, expiresAt: now + SESSION_TTL_MS };
      return next;
    });
    send(res, status, body, { 'Set-Cookie': sessionCookie(sid, { secure: secureCookie }) });
  }

  const checkCredentialsShape = (b) => {
    if (!isSpecLike(b) || typeof b.username !== 'string' || typeof b.password !== 'string') throw new HttpError(400, 'Укажите логин и пароль');
  };

  // Доступ на изменение: вошедший пользователь; формы дополнительно — только владелец или admin.
  async function requireUser(req) {
    const user = await currentUser(req);
    if (!user && requireAuth) throw new HttpError(401, 'Требуется вход');
    return user;
  }
  async function requireAdmin(req) {
    const user = await currentUser(req);
    if (!user) throw new HttpError(401, 'Требуется вход');
    if (user.role !== 'admin') throw new HttpError(403, 'Только для администратора');
    return user;
  }
  const canModify = (user, rec) => !requireAuth || user?.role === 'admin' || (rec.ownerId && rec.ownerId === user?.id);

  async function route(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean); // ['api', 'spec', id]
    const m = req.method;
    if (parts[0] !== 'api') throw new HttpError(404, 'Не найдено');

    if (parts[1] === 'health' && m === 'GET') return send(res, 200, { status: 'ok' });

    if (parts[1] === 'auth') {
      const ip = req.socket.remoteAddress || '';
      if (parts[2] === 'me' && m === 'GET') {
        const user = await currentUser(req);
        const registrationOpen = (await storage.getUsers()).length === 0; // пока пользователей нет, можно создать первого (админа)
        return send(res, 200, { user: user ? publicUser(user) : null, requireAuth, registrationOpen });
      }
      if (parts[2] === 'register' && m === 'POST') {
        // Первый пользователь (в системе никого нет) — саморегистрация, он становится администратором и входит.
        // Дальше — только администратор создаёт пользователей; его собственная сессия не меняется.
        const admin = (await storage.getUsers()).length === 0 ? null : await requireAdmin(req);
        const b = await readJson(req);
        checkCredentialsShape(b);
        const username = b.username.trim();
        if (!USERNAME_RE.test(username)) throw new HttpError(400, 'Логин: 3–32 символа, латиница, цифры, _ . -');
        if (b.password.length < MIN_PASSWORD) throw new HttpError(400, `Пароль не короче ${MIN_PASSWORD} символов`);
        if (b.password.length > MAX_PASSWORD) throw new HttpError(400, `Пароль не длиннее ${MAX_PASSWORD} символов`);
        if (b.role !== undefined && !ROLES.includes(b.role)) throw new HttpError(400, 'Роль: admin или editor');
        const passwordHash = await hashPassword(b.password);
        let created = null;
        let closed = false;
        await storage.updateUsers((users) => {
          if (users.length > 0 && !admin) { closed = true; return users; } // кто-то успел зарегистрироваться первым
          if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) return users;
          created = { id: newId(), username, passwordHash, role: users.length === 0 ? 'admin' : (b.role || 'editor'), createdAt: new Date().toISOString() };
          return [...users, created];
        });
        if (closed) throw new HttpError(403, 'Регистрация закрыта: пользователей создаёт администратор');
        if (!created) throw new HttpError(409, 'Такой логин уже занят');
        if (admin) return send(res, 201, { user: publicUser(created) });
        return startSession(res, created, 201, { user: publicUser(created) });
      }
      if (parts[2] === 'login' && m === 'POST') {
        const b = await readJson(req);
        checkCredentialsShape(b);
        const username = b.username.trim();
        const key = `${ip}|${username.toLowerCase()}`;
        const wait = throttle.blockedFor(key);
        if (wait) throw new HttpError(429, `Слишком много попыток входа. Повторите через ${wait} с`);
        const user = (await storage.getUsers()).find((u) => u.username.toLowerCase() === username.toLowerCase());
        const ok = user ? await verifyPassword(b.password.slice(0, MAX_PASSWORD), user.passwordHash) : (await verifyDummy(b.password.slice(0, MAX_PASSWORD)), false);
        if (!ok) { throttle.fail(key); throw new HttpError(401, 'Неверный логин или пароль'); } // одинаково для «нет пользователя» и «не тот пароль»
        throttle.ok(key);
        return startSession(res, user, 200, { user: publicUser(user) });
      }
      if (parts[2] === 'logout' && m === 'POST') {
        const sid = parseCookies(req.headers.cookie)[COOKIE_NAME];
        if (sid) await storage.updateSessions((all) => { const next = { ...all }; delete next[sessionKey(sid)]; return next; });
        return send(res, 204, undefined, { 'Set-Cookie': sessionCookie('', { secure: secureCookie, maxAgeMs: 0 }) });
      }
      throw new HttpError(404, 'Не найдено');
    }

    if (parts[1] === 'users' && parts.length === 3 && m === 'DELETE') {
      const admin = await requireAdmin(req);
      const id = parts[2];
      if (id === admin.id) throw new HttpError(400, 'Нельзя удалить самого себя');
      let removed = false;
      await storage.updateUsers((users) => {
        const next = users.filter((u) => u.id !== id);
        removed = next.length !== users.length;
        return next;
      });
      if (!removed) throw new HttpError(404, 'Пользователь не найден');
      // все его сессии перестают действовать сразу; формы пользователя остаются (без владельца — правит только админ)
      await storage.updateSessions((all) => Object.fromEntries(Object.entries(all).filter(([, v]) => v.userId !== id)));
      return send(res, 204);
    }

    if (parts[1] === 'users' && parts.length === 2 && m === 'GET') {
      await requireAdmin(req);
      return send(res, 200, (await storage.getUsers()).map((u) => ({ ...publicUser(u), createdAt: u.createdAt })));
    }

    if (parts[1] === 'validate' && m === 'POST') {
      const spec = await readJson(req);
      const errors = validateSpec(spec);
      return send(res, 200, { valid: errors.length === 0, errors });
    }

    if (parts[1] === 'specs' && m === 'GET') {
      const users = await storage.getUsers();
      const names = Object.fromEntries(users.map((u) => [u.id, u.username]));
      return send(res, 200, (await storage.listSpecs()).map((x) => ({ ...x, owner: names[x.ownerId] ?? null })));
    }

    if (parts[1] === 'spec') {
      if (parts.length === 2 && m === 'POST') {
        const user = await requireUser(req);
        const spec = await readJson(req);
        const errors = isSpecLike(spec) ? validateSpec(spec) : [{ path: '$', message: 'Спецификация должна быть объектом' }];
        if (errors.length) throw new HttpError(422, 'Спецификация некорректна', { errors });
        const rec = await storage.saveSpec(spec, user?.id ?? null);
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
          const user = await requireUser(req);
          const existing = await storage.getSpec(id);
          if (!existing) throw new HttpError(404, 'Спецификация не найдена');
          if (!canModify(user, existing)) throw new HttpError(403, 'Изменять форму может только её владелец или администратор');
          const spec = await readJson(req);
          const errors = isSpecLike(spec) ? validateSpec(spec) : [{ path: '$', message: 'Спецификация должна быть объектом' }];
          if (errors.length) throw new HttpError(422, 'Спецификация некорректна', { errors });
          const rec = await storage.updateSpec(id, spec);
          if (!rec) throw new HttpError(404, 'Спецификация не найдена');
          return send(res, 200, rec);
        }
        if (m === 'DELETE') {
          const user = await requireUser(req);
          const existing = await storage.getSpec(id);
          if (existing && !canModify(user, existing)) throw new HttpError(403, 'Удалять форму может только её владелец или администратор');
          if (!(await storage.deleteSpec(id))) throw new HttpError(404, 'Спецификация не найдена');
          return send(res, 204);
        }
      }
    }

    if (parts[1] === 'dictionary') {
      if (parts.length === 2 && m === 'GET') return send(res, 200, normalizeDictionary(await storage.getDictionary()));

      if (m !== 'GET') await requireUser(req); // читать словарь можно всем, менять — только вошедшим

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
