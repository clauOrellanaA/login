import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { openDatabase, seedUser } from './db.js';
import { createApp } from './app.js';

async function setup(t, options = {}) {
  const db = openDatabase(':memory:');
  await seedUser(db, { email: 'persona@example.com', password: 'PruebaLocal2026!', name: 'Persona' });
  const server = createServer(createApp({ db, ...options }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = (body, headers = {}) => fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { db, base, login };
}

test('login crea cookie segura, sesión opaca y permite las rutas protegidas', async (t) => {
  const { db, base, login } = await setup(t, { secureCookies: true });
  const response = await login({ email: ' PERSONA@example.com ', password: 'PruebaLocal2026!' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user: { id: 1, email: 'persona@example.com', name: 'Persona' }, redirect: '/x' });
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly; SameSite=Lax; Path=\/; Max-Age=28800; Secure/);
  const cookie = setCookie.split(';')[0];
  const session = db.prepare('SELECT * FROM sessions').get();
  assert.notEqual(session.token_hash, cookie.slice(8));
  assert.ok(session.expires_at > Date.now());
  for (const route of ['/api/me', '/api/x']) {
    const protectedResponse = await fetch(base + route, { headers: { cookie } });
    assert.equal(protectedResponse.status, 200);
    const body = await protectedResponse.json();
    assert.equal(body.user.email, 'persona@example.com');
    assert.equal(body.user.password_hash, undefined);
    if (route === '/api/x') assert.equal(body.message, 'Bienvenido a Página X');
  }
  db.prepare('UPDATE sessions SET expires_at = 1').run();
  assert.equal((await fetch(base + '/api/me', { headers: { cookie } })).status, 401);
});

test('sin sesión las API rechazan y Página X redirige al login', async (t) => {
  const { base } = await setup(t);
  for (const route of ['/api/me', '/api/x']) assert.equal((await fetch(base + route)).status, 401);
  assert.equal((await fetch(base + '/api/me', { headers: { cookie: 'session=invalid' } })).status, 401);
  const page = await fetch(base + '/x', { redirect: 'manual' });
  assert.equal(page.status, 302);
  assert.equal(page.headers.get('location'), '/');
});

test('valida campos, JSON, tamaño, contenido y credenciales', async (t) => {
  const { login } = await setup(t);
  for (const body of [{}, null, [], { email: 'invalid', password: 'x' }, { email: 'persona@example.com', password: 5 }, '{broken']) assert.equal((await login(body)).status, 400);
  assert.equal((await login({ email: 'persona@example.com', password: 'equivocada' })).status, 401);
  assert.equal((await login({ email: 'ausente@example.com', password: 'equivocada' })).status, 401);
  assert.equal((await login({ email: 'persona@example.com', password: 'x' }, { 'Content-Type': 'text/plain' })).status, 400);
  assert.equal((await login('x'.repeat(5000))).status, 413);
});

test('rechaza Origin ajeno y limita intentos de login', async (t) => {
  const { base, login } = await setup(t);
  const body = { email: 'persona@example.com', password: 'equivocada' };
  assert.equal((await login(body, { Origin: 'https://otro.example' })).status, 403);
  for (let n = 0; n < 10; n++) assert.equal((await login(body, { Origin: base })).status, 401);
  const limited = await login(body);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});

test('sirve SPA y archivos estáticos, y conserva la protección de Página X', async (t) => {
  const distDir = await mkdtemp(path.join(tmpdir(), 'login-static-test-'));
  t.after(() => rm(distDir, { recursive: true, force: true }));
  await writeFile(path.join(distDir, 'index.html'), '<html><body>Login</body></html>');
  await writeFile(path.join(distDir, 'app.js'), 'window.ready = true;');
  const { base, login } = await setup(t, { distDir });
  const index = await fetch(base + '/');
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /text\/html/);
  assert.match(await index.text(), /Login/);
  assert.equal((await fetch(base + '/app.js')).status, 200);
  assert.equal((await fetch(base + '/missing.js')).status, 404);
  assert.equal((await fetch(base + '/%2e%2e%5coutside')).status, 404);
  const response = await login({ email: 'persona@example.com', password: 'PruebaLocal2026!' });
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const protectedPage = await fetch(base + '/x', { headers: { cookie } });
  assert.equal(protectedPage.status, 200);
  assert.match(await protectedPage.text(), /Login/);
});
