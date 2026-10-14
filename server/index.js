import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { createApp } from './app.js';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = openDatabase(process.env.DB_PATH || path.join(projectDir, 'data', 'login.sqlite'));
const port = Number(process.env.PORT || 3000);
const server = createServer(createApp({
  db,
  distDir: path.join(projectDir, 'dist'),
  secureCookies: process.env.NODE_ENV === 'production',
  allowedOrigins: process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : [],
}));
server.listen(port, '127.0.0.1', () => console.log(`Servidor disponible en http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
