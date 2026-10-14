import { createHash, randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { hashPassword, verifyPassword } from './db.js';

const SESSION_DURATION = 8 * 60 * 60 * 1000;
const BODY_LIMIT = 4096;
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
const userView = ({ id, email, name }) => ({ id, email, name });

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) {
      const error = new Error('El cuerpo de la solicitud es demasiado grande.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const error = new Error('El JSON enviado no es válido.'); error.status = 400; throw error; }
}

function sessionUser(req, db) {
  const cookie = req.headers.cookie ?? '';
  const token = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('session='))?.slice(8);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare('SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').get(tokenHash(token), Date.now()) ?? null;
}

export function createApp({ db, distDir, secureCookies = false, allowedOrigins = [] }) {
  const attempts = new Map();
  const dummyPasswordHash = hashPassword(randomBytes(32).toString('hex'));
  const root = distDir ? path.resolve(distDir) : null;
  return async function app(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        if (req.method === 'POST' && url.pathname === '/api/login') {
          if (req.headers.origin) {
            let sameOrigin = false;
            try { sameOrigin = new URL(req.headers.origin).host === req.headers.host; } catch {}
            if (!sameOrigin && !allowedOrigins.includes(req.headers.origin)) return json(res, 403, { error: 'Origen no permitido.' });
          }
          if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) return json(res, 400, { error: 'Envía los datos como JSON.' });
          const key = req.socket.remoteAddress ?? 'unknown';
          const now = Date.now();
          for (const [ip, item] of attempts) if (item.until <= now) attempts.delete(ip);
          let attempt = attempts.get(key);
          if (!attempt) {
            if (attempts.size >= 10000) return json(res, 429, { error: 'Inténtalo más tarde.' });
            attempt = { count: 0, until: now + 15 * 60 * 1000 };
            attempts.set(key, attempt);
          }
          if (attempt.count >= 10) {
            res.setHeader('Retry-After', String(Math.ceil((attempt.until - now) / 1000)));
            return json(res, 429, { error: 'Demasiados intentos. Inténtalo más tarde.' });
          }
          attempt.count += 1;
          const input = await readBody(req);
          if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.email !== 'string' || typeof input.password !== 'string') return json(res, 400, { error: 'Correo y contraseña son obligatorios.' });
          const email = input.email.trim().toLowerCase();
          if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || input.password.length < 1 || input.password.length > 128) return json(res, 400, { error: 'Revisa el correo y la contraseña.' });
          const user = db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').get(email);
          const validPassword = await verifyPassword(input.password, user?.password_hash ?? dummyPasswordHash);
          if (!user || !validPassword) return json(res, 401, { error: 'Correo o contraseña incorrectos.' });
          const token = randomBytes(32).toString('hex');
          db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
          db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash(token), user.id, now + SESSION_DURATION);
          attempts.delete(key);
          res.setHeader('Set-Cookie', `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DURATION / 1000}${secureCookies ? '; Secure' : ''}`);
          return json(res, 200, { user: userView(user), redirect: '/x' });
        }
        if (req.method === 'GET' && (url.pathname === '/api/me' || url.pathname === '/api/x')) {
          const user = sessionUser(req, db);
          if (!user) return json(res, 401, { error: 'Inicia sesión para continuar.' });
          return json(res, 200, url.pathname === '/api/x' ? { message: 'Bienvenido a Página X', user: userView(user) } : { user: userView(user) });
        }
        return json(res, 404, { error: 'Ruta no encontrada.' });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Método no permitido.' });
      if (url.pathname === '/x' && !sessionUser(req, db)) {
        res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store' });
        return res.end();
      }
      if (!root) return json(res, 404, { error: 'Interfaz no disponible.' });
      let file;
      if (url.pathname === '/' || url.pathname === '/x') file = path.join(root, 'index.html');
      else {
        const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        file = path.resolve(root, relative);
        if (!file.startsWith(root + path.sep)) return json(res, 404, { error: 'Ruta no encontrada.' });
      }
      try {
        if (!(await stat(file)).isFile()) return json(res, 404, { error: 'Ruta no encontrada.' });
        const content = await readFile(file);
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
        return res.end(req.method === 'HEAD' ? undefined : content);
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return json(res, 404, { error: 'Ruta no encontrada.' });
        throw error;
      }
    } catch (error) {
      if (res.destroyed || res.writableEnded) return;
      json(res, error.status ?? 500, { error: error.status ? error.message : 'No se pudo completar la solicitud.' });
    }
  };
}
