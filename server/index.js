import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3001;
const dataDir = process.env.DATA_DIR || path.join(here, 'data');

// Первый зарегистрированный пользователь становится администратором; дальше пользователей создаёт только он.
// COOKIE_SECURE=1 — включать, когда сервер работает за HTTPS.
// AUTH=off — отключить авторизацию (только для локальной разработки).
const handler = await createApp({
  dataDir,
  requireAuth: process.env.AUTH !== 'off',
  secureCookie: process.env.COOKIE_SECURE === '1',
});
http.createServer(handler).listen(port, () => {
  console.log(`JSON GUI Builder API: http://localhost:${port}/api/health (данные: ${dataDir})`);
});
