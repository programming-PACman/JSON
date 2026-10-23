// Сборка приложения в один бандл для e2e-тестов в реальном браузере.
// Нужны глобально установленные esbuild (+ react/react-dom доступные по NODE_PATH).
// Запуск: node tests/e2e/build.mjs <outDir>
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const esbuild = require(process.env.ESBUILD_PATH || 'esbuild');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.resolve(process.argv[2] || 'tests/e2e/.dist');
mkdirSync(out, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, 'src/main.jsx')],
  bundle: true,
  outfile: path.join(out, 'app.js'),
  loader: { '.jsx': 'jsx', '.js': 'jsx', '.css': 'css' },
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  nodePaths: (process.env.NODE_PATH || '').split(':').filter(Boolean),
  logLevel: 'error',
});
writeFileSync(path.join(out, 'index.html'),
  '<!doctype html><html lang="ru"><head><meta charset="UTF-8"><title>e2e</title><link rel="stylesheet" href="app.css"></head><body><div id="root"></div><script src="app.js"></script></body></html>');
writeFileSync(path.join(out, 'example-spec.json'), readFileSync(path.join(root, 'example-spec.json')));
console.log('built ->', out);
