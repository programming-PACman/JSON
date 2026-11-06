// Тесты REST API: поднимаем настоящий http-сервер на свободном порту, временная папка данных.
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'jgb-api-'));
const server = http.createServer(await createApp({ dataDir }));
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const call = async (method, url, body, raw) => {
  const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('  ok  ' + name); };

const goodSpec = { title: 'T', elements: [{ name: 'a', label: 'A', type: 'text' }] };
const badSpec = { title: 'T', elements: [{ name: 'a', label: 'A', type: 'nope' }] };

try {
  await test('health', async () => { const r = await call('GET', '/api/health'); assert.equal(r.status, 200); assert.equal(r.json.status, 'ok'); });
  await test('validate: ok и ошибки', async () => {
    assert.equal((await call('POST', '/api/validate', goodSpec)).json.valid, true);
    const r = await call('POST', '/api/validate', badSpec);
    assert.equal(r.json.valid, false); assert.ok(r.json.errors.length > 0);
  });
  let id;
  await test('POST /spec: 201 + id из 12 hex', async () => {
    const r = await call('POST', '/api/spec', goodSpec); assert.equal(r.status, 201);
    assert.match(r.json.id, /^[a-f0-9]{12}$/); id = r.json.id;
  });
  await test('POST /spec: 422 для невалидной, 400 для битого JSON, 413 для большой', async () => {
    const r = await call('POST', '/api/spec', badSpec); assert.equal(r.status, 422); assert.ok(r.json.errors.length);
    assert.equal((await call('POST', '/api/spec', undefined, '{oops')).status, 400);
    assert.equal((await call('POST', '/api/spec', undefined, '')).status, 400);
    assert.equal((await call('POST', '/api/spec', [1])).status, 422);
    let status;
    try { status = (await call('POST', '/api/spec', undefined, JSON.stringify({ pad: 'x'.repeat(1100000) }))).status; } catch { status = 413; /* сервер закрыл соединение */ }
    assert.equal(status, 413);
  });
  await test('GET/PUT /spec/:id', async () => {
    assert.deepEqual((await call('GET', `/api/spec/${id}`)).json.spec, goodSpec);
    const upd = { ...goodSpec, title: 'T2' };
    const r = await call('PUT', `/api/spec/${id}`, upd); assert.equal(r.status, 200); assert.equal(r.json.spec.title, 'T2');
    assert.equal((await call('PUT', `/api/spec/${id}`, badSpec)).status, 422);
    assert.equal((await call('GET', `/api/spec/${id}`)).json.spec.title, 'T2'); // после отказа не изменилось
    assert.equal((await call('PUT', '/api/spec/000000000000', upd)).status, 404);
  });
  await test('GET /spec/:id: 404 и защита от path traversal', async () => {
    assert.equal((await call('GET', '/api/spec/ffffffffffff')).status, 404);
    assert.equal((await call('GET', '/api/spec/..%2F..%2Fdictionary')).status, 404);
    assert.equal((await call('GET', '/api/spec/abc')).status, 404);
  });
  await test('GET /specs и DELETE', async () => {
    const list = (await call('GET', '/api/specs')).json; assert.equal(list.length, 1); assert.equal(list[0].title, 'T2');
    assert.equal((await call('DELETE', `/api/spec/${id}`)).status, 204);
    assert.equal((await call('DELETE', `/api/spec/${id}`)).status, 404);
    assert.equal((await call('GET', '/api/specs')).json.length, 0);
  });
  await test('словарь: PUT/GET/удаление перевода/DELETE', async () => {
    assert.deepEqual((await call('GET', '/api/dictionary')).json, { ru: {}, en: {} });
    let r = await call('PUT', '/api/dictionary/entries/hello', { ru: 'Привет', en: 'Hello' });
    assert.equal(r.json.ru.hello, 'Привет'); assert.equal(r.json.en.hello, 'Hello');
    r = await call('PUT', '/api/dictionary/entries/hello', { en: '' });
    assert.equal(r.json.en.hello, undefined); assert.equal(r.json.ru.hello, 'Привет');
    assert.equal((await call('PUT', '/api/dictionary/entries/1bad', { ru: 'x' })).status, 400);
    assert.equal((await call('PUT', '/api/dictionary/entries/k', { de: 'x' })).status, 400);
    assert.equal((await call('PUT', '/api/dictionary/entries/k', { ru: 5 })).status, 400);
    assert.equal((await call('PUT', '/api/dictionary/entries/k', {})).status, 400);
    r = await call('DELETE', '/api/dictionary/entries/hello'); assert.equal(r.json.ru.hello, undefined);
  });
  await test('словарь: merge', async () => {
    await call('PUT', '/api/dictionary/entries/a', { ru: 'А', en: 'A' });
    const r = await call('POST', '/api/dictionary/merge', { ru: { b: 'Б', bad_: 1 }, en: { b: 'B' } });
    assert.equal(r.json.ru.a, 'А'); assert.equal(r.json.ru.b, 'Б'); assert.equal(r.json.en.b, 'B');
  });
  await test('одновременные PUT словаря не теряют записей', async () => {
    await Promise.all(Array.from({ length: 30 }, (_, i) => call('PUT', `/api/dictionary/entries/k${i}`, { ru: `v${i}` })));
    const d = (await call('GET', '/api/dictionary')).json;
    for (let i = 0; i < 30; i++) assert.equal(d.ru[`k${i}`], `v${i}`);
  });
  await test('неизвестный маршрут → 404; временных файлов не осталось', async () => {
    assert.equal((await call('GET', '/api/nothing')).status, 404);
    assert.equal((await call('GET', '/other')).status, 404);
    const left = [...(await readdir(dataDir)), ...(await readdir(path.join(dataDir, 'specs')))].filter((f) => f.endsWith('.tmp'));
    assert.deepEqual(left, []);
  });
  console.log(`API: ${passed} тестов пройдено`);
} finally {
  server.close();
  await rm(dataDir, { recursive: true, force: true });
}
