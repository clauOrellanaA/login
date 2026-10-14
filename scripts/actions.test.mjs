import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, openDatabase, seedUser, verifyPassword } from '../server/db.js';

test('1. La base de datos aplica la migracion y comienza sin usuarios', (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
  assert.equal(db.prepare('SELECT count(*) AS total FROM users').get().total, 0);
});

test('2. El usuario se guarda con correo normalizado y contrasena cifrada con hash', (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const user = seedUser(db, { email: ' DEMO@example.com ', name: ' Demo ', password: 'TestActions2026!' });
  assert.equal(user.email, 'demo@example.com');
  assert.equal(user.name, 'Demo');
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
  assert.notEqual(row.password_hash, 'TestActions2026!');
  assert.equal(verifyPassword('TestActions2026!', row.password_hash), true);
});

test('3. La autenticacion rechaza una contrasena incorrecta', () => {
  const hash = hashPassword('TestActions2026!');
  assert.equal(verifyPassword('incorrecta', hash), false);
  assert.equal(verifyPassword('TestActions2026!', hash), true);
});

test('4. Repetir el seed conserva la identidad y la contrasena original', (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const first = seedUser(db, { email: 'demo@example.com', name: 'Demo', password: 'Original2026!' });
  const second = seedUser(db, { email: 'DEMO@example.com', name: 'Otro', password: 'Cambio2026!' });
  assert.deepEqual(second, first);
  assert.equal(db.prepare('SELECT count(*) AS total FROM users').get().total, 1);
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(first.id);
  assert.equal(verifyPassword('Original2026!', row.password_hash), true);
  assert.equal(verifyPassword('Cambio2026!', row.password_hash), false);
});

test('5. FALLO INTENCIONAL: demostracion de un test fallido en GitHub Actions', () => {
  assert.fail('Fallo solicitado para demostrar GitHub Actions. Elimina este test cuando quieras que el workflow pase.');
});
