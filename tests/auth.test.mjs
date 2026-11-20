// Тесты авторизации: настоящий http-сервер, у каждого «пользователя» своя cookie-банка.
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createThrottle, hashPassword, verifyPassword, parseCookies } from '../server/auth.js';

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'jgb-auth-'));
let t = 0;
const clock = { now: () => t };
const server = http.createServer(await createApp({ dataDir, throttle: createThrottle({ now: clock.now }) }));
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const client = () => {
  const jar = {};
  const call = async (method, url, body, extraHeaders = {}) => {
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get('set-cookie');
    if (set) { const [pair] = set.split(';'); const i = pair.indexOf('='); const v = pair.slice(i + 1); if (v) jar[pair.slice(0, i)] = v; else delete jar[pair.slice(0, i)]; }
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null, setCookie: set };
  };
  return { call, jar };
};

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('  ok  ' + name); };
const spec = { title: 'T', elements: [{ name: 'a', label: 'A', type: 'text' }] };

try {
  const anon = client(), alice = client(), bob = client();

  await test('хеш пароля: соль, проверка, неверный пароль', async () => {
    const h1 = await hashPassword('secret-pass'), h2 = await hashPassword('secret-pass');
    assert.notEqual(h1, h2);
    assert.ok(await verifyPassword('secret-pass', h1));
    assert.ok(!(await verifyPassword('secret-pasS', h1)));
    assert.ok(!(await verifyPassword('x', 'garbage')));
  });

  await test('аноним: читать можно, изменять нельзя', async () => {
    assert.equal((await anon.call('GET', '/api/specs')).status, 200);
    assert.equal((await anon.call('GET', '/api/dictionary')).status, 200);
    assert.equal((await anon.call('POST', '/api/validate', spec)).status, 200);
    assert.equal((await anon.call('POST', '/api/spec', spec)).status, 401);
    assert.equal((await anon.call('PUT', '/api/dictionary/entries/k', { ru: 'x' })).status, 401);
    assert.equal((await anon.call('DELETE', '/api/dictionary/entries/k')).status, 401);
    assert.equal((await anon.call('POST', '/api/dictionary/merge', { ru: {} })).status, 401);
    const me = await anon.call('GET', '/api/auth/me');
    assert.equal(me.status, 200); assert.equal(me.json.user, null);
  });

  await test('регистрация: первый — admin, cookie HttpOnly+SameSite, пароль не возвращается', async () => {
    const r = await alice.call('POST', '/api/auth/register', { username: 'Alice', password: 'password1' });
    assert.equal(r.status, 201); assert.equal(r.json.user.role, 'admin');
    assert.equal(JSON.stringify(r.json).includes('password'), false);
    assert.match(r.setCookie, /HttpOnly/); assert.match(r.setCookie, /SameSite=Lax/);
    assert.equal((await alice.call('GET', '/api/auth/me')).json.user.username, 'Alice');
  });

  await test('после первого пользователя саморегистрация закрыта (аноним и обычный пользователь — отказ)', async () => {
    assert.equal((await anon.call('GET', '/api/auth/me')).json.registrationOpen, false);
    assert.equal((await anon.call('POST', '/api/auth/register', { username: 'intruder', password: 'password1' })).status, 401);
    assert.equal((await anon.call('GET', '/api/users')).status, 401);
  });

  await test('админ создаёт пользователя: роль по умолчанию editor, своя сессия не меняется, дубликаты и плохие данные отклоняются', async () => {
    const before = alice.jar.sid;
    assert.equal((await alice.call('POST', '/api/auth/register', { username: 'alice', password: 'password1' })).status, 409);
    assert.equal((await alice.call('POST', '/api/auth/register', { username: 'bob', password: 'short' })).status, 400);
    assert.equal((await alice.call('POST', '/api/auth/register', { username: 'b o b', password: 'password1' })).status, 400);
    assert.equal((await alice.call('POST', '/api/auth/register', { username: 'bob' })).status, 400);
    assert.equal((await alice.call('POST', '/api/auth/register', { username: 'bob', password: 'password2', role: 'root' })).status, 400);
    const r = await alice.call('POST', '/api/auth/register', { username: 'bob', password: 'password2' });
    assert.equal(r.status, 201); assert.equal(r.json.user.role, 'editor');
    assert.equal(r.setCookie, null); // админ остался собой, а не «вошёл» под новым
    assert.equal(alice.jar.sid, before);
    assert.equal((await alice.call('GET', '/api/auth/me')).json.user.username, 'Alice');
    const adm2 = await alice.call('POST', '/api/auth/register', { username: 'dave', password: 'password4', role: 'admin' });
    assert.equal(adm2.json.user.role, 'admin');
  });

  await test('обычный пользователь не может создавать пользователей и смотреть их список', async () => {
    const r = await bob.call('POST', '/api/auth/login', { username: 'bob', password: 'password2' });
    assert.equal(r.status, 200);
    assert.equal((await bob.call('POST', '/api/auth/register', { username: 'eve', password: 'password1' })).status, 403);
    assert.equal((await bob.call('GET', '/api/users')).status, 403);
  });

  await test('список пользователей для админа: без паролей', async () => {
    const r = await alice.call('GET', '/api/users');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.map((u) => u.username), ['Alice', 'bob', 'dave']); // (до тестов удаления)
    assert.ok(!JSON.stringify(r.json).includes('scrypt') && !JSON.stringify(r.json).includes('passwordHash'));
  });

  await test('удаление пользователя: только админ, не себя; сессии удалённого гаснут, логин освобождается', async () => {
    const users = (await alice.call('GET', '/api/users')).json;
    const idOf = (n) => users.find((u) => u.username === n).id;
    const victim = client();
    await alice.call('POST', '/api/auth/register', { username: 'victim', password: 'password5' });
    await victim.call('POST', '/api/auth/login', { username: 'victim', password: 'password5' });
    assert.equal((await victim.call('GET', '/api/auth/me')).json.user.username, 'victim');
    const vid = (await alice.call('GET', '/api/users')).json.find((u) => u.username === 'victim').id;
    assert.equal((await anon.call('DELETE', `/api/users/${vid}`)).status, 401);
    assert.equal((await bob.call('DELETE', `/api/users/${vid}`)).status, 403);          // editor не может
    assert.equal((await victim.call('DELETE', `/api/users/${idOf('Alice')}`)).status, 403);
    assert.equal((await alice.call('DELETE', `/api/users/${idOf('Alice')}`)).status, 400); // нельзя себя
    assert.equal((await alice.call('DELETE', '/api/users/ffffffffffff')).status, 404);
    assert.equal((await alice.call('DELETE', `/api/users/${vid}`)).status, 204);
    assert.equal((await victim.call('GET', '/api/auth/me')).json.user, null);              // открытая сессия умерла
    assert.equal((await victim.call('POST', '/api/spec', spec)).status, 401);
    assert.equal((await victim.call('POST', '/api/auth/login', { username: 'victim', password: 'password5' })).status, 401);
    assert.ok(!(await alice.call('GET', '/api/users')).json.some((u) => u.id === vid));
    assert.equal((await alice.call('POST', '/api/auth/register', { username: 'victim', password: 'password6' })).status, 201); // логин свободен
    assert.equal((await alice.call('DELETE', `/api/users/${(await alice.call('GET', '/api/users')).json.find((u) => u.username === 'victim').id}`)).status, 204);
  });

  await test('форма удалённого пользователя остаётся и теперь правится только админом', async () => {
    const tmp = client();
    await alice.call('POST', '/api/auth/register', { username: 'temp', password: 'password7' });
    await tmp.call('POST', '/api/auth/login', { username: 'temp', password: 'password7' });
    const sid = (await tmp.call('POST', '/api/spec', spec)).json.id;
    const tid = (await alice.call('GET', '/api/users')).json.find((u) => u.username === 'temp').id;
    await alice.call('DELETE', `/api/users/${tid}`);
    const list = (await anon.call('GET', '/api/specs')).json;
    assert.equal(list.find((x) => x.id === sid).owner, null);
    assert.equal((await bob.call('PUT', `/api/spec/${sid}`, spec)).status, 403);
    assert.equal((await alice.call('PUT', `/api/spec/${sid}`, spec)).status, 200);
  });

  await test('файлы пользователей/сессий: права 0600, пароль не лежит открытым текстом, сессия — хеш', async () => {
    for (const f of ['users.json', 'sessions.json']) assert.equal((await stat(path.join(dataDir, f))).mode & 0o777, 0o600);
    const users = await readFile(path.join(dataDir, 'users.json'), 'utf8');
    assert.ok(!users.includes('password1') && users.includes('scrypt$'));
    const sid = alice.jar.sid;
    assert.ok(!(await readFile(path.join(dataDir, 'sessions.json'), 'utf8')).includes(sid));
  });

  let id;
  await test('вошедший сохраняет форму и словарь', async () => {
    const r = await alice.call('POST', '/api/spec', spec); assert.equal(r.status, 201); id = r.json.id;
    assert.equal((await alice.call('GET', `/api/spec/${id}`)).json.ownerId.length > 0, true);
    assert.equal((await anon.call('GET', '/api/specs')).json[0].owner, 'Alice'); // список виден всем, с именем владельца
    assert.equal((await bob.call('GET', `/api/spec/${id}`)).status, 200);        // любой вошедший может открыть
    assert.equal((await bob.call('PUT', '/api/dictionary/entries/k', { ru: 'x' })).status, 200);
  });

  await test('чужую форму менять и удалять нельзя, админ — можно, владелец — можно', async () => {
    assert.equal((await bob.call('PUT', `/api/spec/${id}`, { ...spec, title: 'hack' })).status, 403);
    assert.equal((await bob.call('DELETE', `/api/spec/${id}`)).status, 403);
    assert.equal((await anon.call('PUT', `/api/spec/${id}`, spec)).status, 401);
    const bobSpec = (await bob.call('POST', '/api/spec', spec)).json.id;
    assert.equal((await bob.call('PUT', `/api/spec/${bobSpec}`, { ...spec, title: 'mine' })).status, 200);
    assert.equal((await alice.call('PUT', `/api/spec/${bobSpec}`, { ...spec, title: 'by admin' })).status, 200);
    assert.equal((await alice.call('DELETE', `/api/spec/${bobSpec}`)).status, 204);
    assert.equal((await bob.call('PUT', '/api/spec/ffffffffffff', spec)).status, 404);
  });

  await test('вход: неверный пароль и неизвестный логин — одинаковый ответ', async () => {
    const c = client();
    const a = await c.call('POST', '/api/auth/login', { username: 'alice', password: 'wrongpass1' });
    const b = await c.call('POST', '/api/auth/login', { username: 'nobody', password: 'wrongpass1' });
    assert.equal(a.status, 401); assert.equal(b.status, 401); assert.deepEqual(a.json, b.json);
    const ok = await c.call('POST', '/api/auth/login', { username: 'ALICE', password: 'password1' });
    assert.equal(ok.status, 200); assert.equal(ok.json.user.username, 'Alice');
    assert.equal((await c.call('POST', '/api/spec', spec)).status, 201);
  });

  await test('выход: сессия перестаёт работать даже со старой cookie', async () => {
    const c = client();
    await c.call('POST', '/api/auth/login', { username: 'bob', password: 'password2' });
    const old = c.jar.sid;
    assert.equal((await c.call('POST', '/api/auth/logout')).status, 204);
    assert.equal((await c.call('GET', '/api/auth/me')).json.user, null);
    const replay = await fetch(`${base}/api/spec`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: `sid=${old}` }, body: JSON.stringify(spec) });
    assert.equal(replay.status, 401);
  });

  await test('подделанная или битая cookie не пускает и не роняет сервер', async () => {
    for (const cookie of ['sid=abc', 'sid=%E0%A4%A', 'sid=', 'garbage']) {
      const r = await fetch(`${base}/api/spec`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(spec) });
      assert.equal(r.status, 401);
    }
  });

  await test('подбор пароля: после 5 неудач — 429, через минуту снова можно; другой логин не затронут', async () => {
    const c = client();
    for (let i = 0; i < 5; i++) assert.equal((await c.call('POST', '/api/auth/login', { username: 'bob', password: `bad-pass-${i}` })).status, 401);
    assert.equal((await c.call('POST', '/api/auth/login', { username: 'bob', password: 'password2' })).status, 429); // даже верный пароль
    assert.equal((await c.call('POST', '/api/auth/login', { username: 'alice', password: 'password1' })).status, 200);
    t += 61_000;
    assert.equal((await c.call('POST', '/api/auth/login', { username: 'bob', password: 'password2' })).status, 200);
  });

  await test('просроченная сессия не действует', async () => {
    const c = client();
    await c.call('POST', '/api/auth/login', { username: 'alice', password: 'password1' });
    const realNow = Date.now; Date.now = () => realNow() + 8 * 24 * 3600 * 1000;
    try { assert.equal((await c.call('GET', '/api/auth/me')).json.user, null); } finally { Date.now = realNow; }
  });

  await test('параллельная регистрация одного логина: создаётся ровно один', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => alice.call('POST', '/api/auth/register', { username: 'racer', password: 'password3' })));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 4);
  });

  console.log(`Авторизация: ${passed} тестов пройдено`);
} finally {
  server.close();
  await rm(dataDir, { recursive: true, force: true });
}

// самый первый пользователь: параллельная регистрация — админом становится ровно один, остальным отказ
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'jgb-auth2-'));
  const s2 = http.createServer(await createApp({ dataDir: dir }));
  await new Promise((r) => s2.listen(0, r));
  const post = (u) => fetch(`http://127.0.0.1:${s2.address().port}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u) });
  try {
    const me = await (await fetch(`http://127.0.0.1:${s2.address().port}/api/auth/me`)).json();
    assert.equal(me.registrationOpen, true);
    const rs = await Promise.all(['user1', 'user2', 'user3'].map((n) => post({ username: n, password: 'password1' })));
    const statuses = rs.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 403, 403]);
    console.log('  ok  первый пользователь: из трёх одновременных регистраций админом стал один, остальным отказ');
  } finally { s2.close(); await rm(dir, { recursive: true, force: true }); }
}
