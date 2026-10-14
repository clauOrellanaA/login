import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { hashPassword, openDatabase, seedUser, verifyPassword } from './db.js';

test('migration persists and can reopen without erasing users or seeding automatically', () => {
  const directory = mkdtempSync(join(tmpdir(), 'login-db-test-'));
  const path = join(directory, 'nested', 'test.sqlite');
  let db;
  try {
    db = openDatabase(path);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 0);
    const user = seedUser(db, { email: '  DEMO@example.test ', name: ' Demo ', password: 'fictitious-password' });
    assert.equal(user.email, 'demo@example.test');
    assert.equal(user.name, 'Demo');
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 1);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    assert.notEqual(row.password_hash, 'fictitious-password');
    assert.equal(verifyPassword('fictitious-password', row.password_hash), true);
    const second = seedUser(db, { email: 'DEMO@example.test', name: 'Changed', password: 'different' });
    assert.equal(second.id, user.id);
    assert.equal(second.name, 'Demo');
    assert.equal(db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id).password_hash, row.password_hash);
  } finally {
    db?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('constraints enforce unique canonical emails, foreign keys, integer expiry and session ownership', () => {
  const db = openDatabase(':memory:');
  try {
    const user = seedUser(db, { email: 'person@example.test', name: 'Person', password: 'fake-password' });
    const insert = db.prepare('INSERT INTO users(email, name, password_hash) VALUES (?, ?, ?)');
    assert.throws(() => insert.run('person@example.test', 'Another', 'hash'), /UNIQUE/);
    assert.throws(() => insert.run(' PERSON@example.test ', 'Another', 'hash'), /CHECK/);
    assert.throws(() => insert.run(null, 'Another', 'hash'), /NOT NULL/);
    const session = db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)');
    assert.throws(() => session.run('missing-user', 999, Date.now() + 1000), /FOREIGN KEY/);
    assert.throws(() => session.run('bad-expiry', user.id, -1), /CHECK/);
    assert.throws(() => session.run('bad-type', user.id, 'tomorrow'), /INTEGER/);
    session.run('hashed-token', user.id, Date.now() + 1000);
    assert.throws(() => session.run('hashed-token', user.id, Date.now() + 1000), /UNIQUE/);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
  } finally {
    db.close();
  }
});

test('password hashes are salted and reject incorrect passwords and malformed values', () => {
  const first = hashPassword('example-test-password');
  assert.notEqual(first, hashPassword('example-test-password'));
  assert.equal(verifyPassword('example-test-password', first), true);
  assert.equal(verifyPassword('wrong-password', first), false);
  for (const invalid of [null, '', 'scrypt:x:x', 'plaintext', 'scrypt:' + 'a'.repeat(32) + ':zz']) {
    assert.equal(verifyPassword('example-test-password', invalid), false);
  }
  assert.equal(verifyPassword(null, first), false);
  assert.throws(() => hashPassword(''), /non-empty/);
});
