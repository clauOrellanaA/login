# Login y Página X

## GitHub Actions

El workflow `.github/workflows/tests.yml` se ejecuta al subir cambios, abrir un pull request o iniciarlo manualmente. Instala las dependencias, compila el frontend y ejecuta exactamente cinco tests con `npm run test:actions`.

Los cinco tests deben pasar. El quinto comprueba que SQLite rechaza sesiones de usuarios inexistentes y reemplaza el fallo intencional de la demostracion inicial. Las ocho pruebas existentes siguen disponibles mediante `npm test`.

## Hook de Git

Ejecuta `npm run hooks:install` una vez en cada clon para activar `.githooks/pre-commit`. Antes de cada commit, el hook sustituye el bloque exacto del fallo intencional original por la quinta prueba de integridad de sesiones, agrega esa correccion al commit y ejecuta las cinco pruebas de Actions y las ocho existentes. Si alguna falla, bloquea el commit. Si el archivo de pruebas tiene cambios sin agregar, pide ejecutar `git add scripts/actions.test.mjs` antes de corregirlo. Otros fallos requieren corregir el codigo correspondiente.

React + Vite, servidor Node.js y SQLite. Requiere Node.js 24 o superior.

## Preparación (PowerShell)

```powershell
npm.cmd install
$env:DEMO_EMAIL = 'demo@example.com'
$env:DEMO_PASSWORD = 'PruebaLocal2026!'
$env:DEMO_NAME = 'Usuario de prueba'
npm.cmd run seed
Remove-Item Env:DEMO_PASSWORD
```

Estas credenciales ficticias se crean solo al ejecutar el seed. Puedes elegir otras antes de ejecutarlo. La contraseña se almacena como hash; no existe registro público.

## Ejecutar

Para servir la aplicación completa:

```powershell
npm.cmd run build
npm.cmd start
```

Abre http://localhost:3000. Inicia sesión con el usuario creado: se redirige a `/x`. La página y su API requieren una sesión válida.

Para desarrollo, ejecuta `npm.cmd run server` en una terminal y `npm.cmd run dev` en otra. Abre la dirección que muestra Vite; las solicitudes `/api` se envían al servidor del puerto 3000.

## Configuración y pruebas

`DB_PATH` permite cambiar el archivo SQLite (por defecto `data/login.sqlite`). `PORT` configura el puerto del servidor (3000 por defecto). Usa la misma `DB_PATH` al preparar el usuario y ejecutar el servidor. Las migraciones se aplican al abrir la base; no se borran datos. Consulta `server/db.js` para el esquema y sus restricciones.

```powershell
npm.cmd test
npm.cmd run build
node scripts/smoke.mjs
```

La prueba smoke usa SQLite en memoria y comprueba la interfaz compilada, sus recursos, el login y el acceso protegido por HTTP. No reemplaza una comprobación visual en navegador.

El servidor usa cookies HttpOnly y sesiones de ocho horas. En producción configura `NODE_ENV=production` y sirve con HTTPS para las cookies Secure. No se incluyen registro ni cierre de sesión.

Contrato: `POST /api/login` recibe `{email,password}` y devuelve `{user,redirect:"/x"}`; `GET /api/me` devuelve `{user}` y `GET /api/x` devuelve `{message,user}`. Entradas inválidas reciben 400 y credenciales incorrectas o sesiones ausentes reciben 401.
