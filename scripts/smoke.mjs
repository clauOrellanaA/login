import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { openDatabase, seedUser } from '../server/db.js';
import { createApp } from '../server/app.js';

const db = openDatabase(':memory:');
seedUser(db, { email: 'demo@example.com', password: 'PruebaLocal2026!', name: 'Demo' });
const server = createServer(createApp({ db, distDir: fileURLToPath(new URL('../dist', import.meta.url)) }));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const home = await fetch(base);
  assert.equal(home.status, 200);
  const html = await home.text();
  const asset = html.match(/src="([^"]+\.js)"/)[1];
  assert.equal((await fetch(base + asset)).status, 200);
  assert.equal((await fetch(base + '/x', { redirect: 'manual' })).status, 302);
  const result = await fetch(base + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@example.com', password: 'PruebaLocal2026!' }),
  });
  assert.equal(result.status, 200);
  const { redirect } = await result.json();
  const cookie = result.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base + redirect, { headers: { cookie } })).status, 200);
  const api = await fetch(base + '/api/x', { headers: { cookie } });
  assert.equal(api.status, 200);
  assert.equal((await api.json()).user.email, 'demo@example.com');
  console.log('PASS: interfaz compilada, login HTTP, SQLite y Página X protegida.');
} finally {
  await new Promise(resolve => server.close(resolve));
  db.close();
}
