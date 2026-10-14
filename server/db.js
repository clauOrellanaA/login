import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** Opens a local database and applies the non-destructive schema v1 migration.
 * No automatic rollback is supplied: retain a backup before future migrations.
 */
export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version > 1) throw new Error('Database schema is newer than this application supports.');
    if (version === 0) {
      db.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          email TEXT NOT NULL COLLATE NOCASE UNIQUE
            CHECK (length(email) > 0 AND email = lower(trim(email))),
          name TEXT NOT NULL CHECK (length(trim(name)) > 0),
          password_hash TEXT NOT NULL CHECK (length(password_hash) > 0)
        ) STRICT;
        CREATE TABLE sessions (
          token_hash TEXT PRIMARY KEY NOT NULL CHECK (length(token_hash) > 0),
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL CHECK (expires_at > 0)
        ) STRICT;
        CREATE INDEX sessions_user_id_idx ON sessions(user_id);
        CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
        PRAGMA user_version = 1;
        COMMIT;
      `);
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('Password must be a non-empty string.');
  }
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${key}`;
}

export function verifyPassword(password, hash) {
  if (typeof password !== 'string' || typeof hash !== 'string') return false;
  const match = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(hash);
  if (!match) return false;
  const actual = scryptSync(password, match[1], 64);
  return timingSafeEqual(actual, Buffer.from(match[2], 'hex'));
}

/** Explicit demo seed. Existing identities are preserved, including passwords. */
export function seedUser(db, { email, password, name }) {
  if (typeof email !== 'string' || !email.trim() || typeof name !== 'string' || !name.trim()) {
    throw new TypeError('Email and name must be non-empty strings.');
  }
  const normalizedEmail = email.trim().toLowerCase();
  db.prepare(`
    INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)
    ON CONFLICT(email) DO NOTHING
  `).run(normalizedEmail, name.trim(), hashPassword(password));
  return db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(normalizedEmail);
}
