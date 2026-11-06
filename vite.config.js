import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// В режиме разработки запросы /api проксируются на сервер (npm run server, порт 3001)
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3001' } },
});
