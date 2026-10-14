import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, seedUser } from './db.js';

const { DEMO_EMAIL, DEMO_PASSWORD, DEMO_NAME } = process.env;
if (!DEMO_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(DEMO_EMAIL.trim()) || DEMO_EMAIL.trim().length > 254 || !DEMO_PASSWORD || DEMO_PASSWORD.length > 128 || !DEMO_NAME?.trim()) {
  console.error('Define DEMO_EMAIL válido, DEMO_PASSWORD (1–128 caracteres) y DEMO_NAME para crear el usuario.');
  process.exitCode = 1;
} else {
  const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const db = openDatabase(process.env.DB_PATH || path.join(projectDir, 'data', 'login.sqlite'));
  try {
    await seedUser(db, { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: DEMO_NAME });
    console.log('Usuario disponible. Si ya existía, se conservaron sus credenciales.');
  } catch {
    console.error('No se pudo crear el usuario. Revisa los datos de entorno.');
    process.exitCode = 1;
  } finally { db.close(); }
}
