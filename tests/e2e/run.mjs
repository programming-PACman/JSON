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
import { mkdtempSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = mkdtempSync(path.join(os.tmpdir(), 'jgb-e2e-'));
execFileSync('node', [path.join(here, 'build.mjs'), dist], { stdio: 'inherit' });

const server = createServer((req, res) => {
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
const scenarios = (await import('./scenarios.mjs')).default;

for (const [title, fn] of Object.entries(scenarios)) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  try {
    await fn({ page, url, specText, check: (n, c) => check(`[${title}] ${n}`, c) });
  } catch (e) {
    check(`[${title}] сценарий завершился без исключения (${String(e.message).split('\n')[0]})`, false);
  }
  check(`[${title}] нет ошибок в консоли браузера`, errors.length === 0);
  if (errors.length) console.log('   ', errors.slice(0, 3));
  await context.close();
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} FAILED` : '\nE2E: ALL PASSED');
process.exit(failed ? 1 : 0);
