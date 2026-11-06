// E2E в реальном Chromium. Нужны глобально: playwright, esbuild, react, react-dom.
//   NODE_PATH=<глобальные node_modules> node tests/e2e/run.mjs
// Не входит в `npm test` (требует браузер); основные проверки логики — в tests/*.test.mjs.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { createApp } from '../../server/app.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = mkdtempSync(path.join(os.tmpdir(), 'jgb-e2e-'));
execFileSync('node', [path.join(here, 'build.mjs'), dist], { stdio: 'inherit' });

// REST API поднимается в том же процессе: запросы /api идут в настоящий обработчик сервера,
// на каждый сценарий — своя пустая папка данных. state.offline = true имитирует недоступный сервер.
const apiState = { handler: null, offline: false };
const server = createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    if (apiState.offline || !apiState.handler) { req.socket.destroy(); return; }
    apiState.handler(req, res);
    return;
  }
  const f = path.join(dist, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  const type = f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.json') ? 'application/json' : 'text/html';
  res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;
const specText = readFileSync(path.join(here, '../../example-spec.json'), 'utf8');

let failed = 0;
const check = (name, cond) => { console.log((cond ? 'ok:   ' : 'FAIL: ') + name); if (!cond) failed++; };

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const scenarioModule = await import('./scenarios.mjs');
const scenarios = scenarioModule.default;

for (const [title, fn] of Object.entries(scenarios)) {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'jgb-e2e-data-'));
  apiState.handler = await createApp({ dataDir });
  apiState.offline = false;
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !(scenarioModule.expectNetworkErrors.has(title) && /Failed to load resource/.test(m.text()))) errors.push(m.text()); });
  await page.goto(url);
  try {
    await fn({ page, url, specText, browser, apiState, check: (n, c) => check(`[${title}] ${n}`, c) });
  } catch (e) {
    check(`[${title}] сценарий завершился без исключения (${String(e.message).split('\n')[0]})`, false);
  }
  check(`[${title}] нет ошибок в консоли браузера`, errors.length === 0);
  if (errors.length) console.log('   ', errors.slice(0, 3));
  await context.close();
  rmSync(dataDir, { recursive: true, force: true });
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} FAILED` : '\nE2E: ALL PASSED');
process.exit(failed ? 1 : 0);
