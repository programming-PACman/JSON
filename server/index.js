import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3001;
const dataDir = process.env.DATA_DIR || path.join(here, 'data');

const handler = await createApp({ dataDir });
http.createServer(handler).listen(port, () => {
  console.log(`JSON GUI Builder API: http://localhost:${port}/api/health (данные: ${dataDir})`);
});
