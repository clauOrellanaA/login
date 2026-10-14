import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const file = 'scripts/actions.test.mjs';
const source = readFileSync(file, 'utf8');
const intentional = `test('5. FALLO INTENCIONAL: demostracion de un test fallido en GitHub Actions', () => {
  assert.fail('Fallo solicitado para demostrar GitHub Actions. Elimina este test cuando quieras que el workflow pase.');
});`;
const replacement = `test('5. La base de datos rechaza sesiones de usuarios inexistentes', (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const insert = db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)');
  assert.throws(() => insert.run('token-de-prueba', 999, Date.now() + 1000), /FOREIGN KEY/);
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions').get().total, 0);
});`;

if (source.replaceAll('\r\n', '\n').includes(intentional)) {
  const diff = spawnSync('git', ['diff', '--quiet', '--', file]);
  if (diff.error) throw diff.error;
  if (diff.status !== 0) {
    console.error('Agrega primero los cambios de scripts/actions.test.mjs con git add para que el hook pueda corregirlo sin incluir cambios pendientes.');
    process.exit(1);
  }
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  writeFileSync(file, source.replace(intentional.replaceAll('\n', newline), replacement.replaceAll('\n', newline)));
  run('git', ['add', '--', file]);
  console.log('Hook: fallo intencional sustituido por una prueba de integridad de sesiones.');
}

run(process.execPath, ['--test', 'scripts/actions.test.mjs']);
run(process.execPath, ['--test', 'server/app.test.js', 'server/db.test.js']);
