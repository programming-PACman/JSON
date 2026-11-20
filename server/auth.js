// Учётные записи и сессии. Без внешних зависимостей: пароли — scrypt с солью,
// сессии — случайный идентификатор в HttpOnly-cookie; на сервере хранится только его SHA-256
// (утечка файла сессий не даёт войти). Пароль и идентификаторы сессий в логи не попадают.
import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const COOKIE_NAME = 'sid';
export const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 200; // scrypt на очень длинной строке — лишняя нагрузка

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, saltB64, keyB64] = String(stored).split('$');
  if (alg !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

// Фиктивный хеш: при неизвестном логине всё равно тратим то же время, чтобы по скорости
// ответа нельзя было отличить «нет такого пользователя» от «неверный пароль».
let dummyHash;
export async function verifyDummy(password) {
  dummyHash ??= await hashPassword('dummy-password');
  await verifyPassword(password, dummyHash);
}

export const sessionKey = (sid) => createHash('sha256').update(sid).digest('hex');
export const newSessionId = () => randomBytes(32).toString('base64url');

export function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) { try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* битая cookie — игнорируем */ } }
  });
  return out;
}

export function sessionCookie(sid, { secure, maxAgeMs = SESSION_TTL_MS } = {}) {
  const parts = [`${COOKIE_NAME}=${sid}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

// Ограничение подбора пароля: 5 неудач подряд для пары «адрес + логин» → блокировка на минуту.
export function createThrottle({ max = 5, lockMs = 60_000, now = () => Date.now() } = {}) {
  const map = new Map();
  return {
    blockedFor(key) {
      const e = map.get(key);
      return e && e.until > now() ? Math.ceil((e.until - now()) / 1000) : 0;
    },
    fail(key) {
      let e = map.get(key);
      if (e && e.until && e.until <= now()) e = undefined; // блокировка истекла — считаем заново
      const count = (e?.count || 0) + 1;
      map.set(key, count >= max ? { count: 0, until: now() + lockMs } : { count, until: 0 });
    },
    ok(key) { map.delete(key); },
  };
}

export const publicUser = (u) => ({ id: u.id, username: u.username, role: u.role });
