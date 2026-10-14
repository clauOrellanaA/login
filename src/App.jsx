import { useEffect, useState } from 'react';
import { login, request } from './api.js';

function Arrow() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Brand() {
  return <a className="brand" href="/" aria-label="Espacio X, inicio"><span className="brand-symbol" aria-hidden="true">x</span>espacio<span className="brand-x">x</span></a>;
}

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => { document.title = 'Inicio de sesión · Espacio X'; }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      setSuccess(true);
      window.location.assign('/x');
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return <main className="login-layout">
    <section className="story-panel" aria-label="Bienvenida a Espacio X">
      <Brand />
      <div className="story-content">
        <span className="eyebrow"><span className="little-dot" /> TU ESPACIO, A UN PASO</span>
        <h1>Todo empieza<br />con un <em>hola.</em></h1>
        <p>Entra, conecta y continúa.<br />Tu espacio te está esperando.</p>
        <div className="orbit-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-center">x</div><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-star">✳</span></div>
      </div>
      <p className="story-footer">Un lugar para lo que viene.</p>
    </section>
    <section className="form-panel" aria-labelledby="login-heading">
      <div className="mobile-brand"><Brand /></div>
      <div className="login-card">
        <span className="form-eyebrow">BIENVENIDO DE NUEVO</span>
        <h2 id="login-heading">Inicia sesión</h2>
        <p className="form-intro">Ingresa tus datos para acceder a tu espacio.</p>
        <form onSubmit={handleSubmit} aria-busy={loading}>
          <div className="field"><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="username" placeholder="tu@correo.com" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required disabled={loading} /></div>
          <div className="field"><label htmlFor="password">Contraseña</label><div className="password-field"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Ingresa tu contraseña" value={password} onChange={event => setPassword(event.target.value)} required disabled={loading} /><button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} disabled={loading}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div></div>
          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading}>{success ? 'Acceso correcto…' : loading ? 'Ingresando…' : 'Entrar a mi espacio'}{loading ? <span className="spinner" aria-hidden="true" /> : <Arrow />}</button>
          <div className="status-text" role="status" aria-live="polite">{success ? 'Sesión iniciada. Abriendo Página X.' : loading ? 'Comprobando tus credenciales.' : ''}</div>
        </form>
        <p className="secure-note"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m12 3 7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Z" stroke="currentColor" strokeWidth="1.5" /><path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.5" /></svg>Tu sesión está protegida.</p>
      </div>
      <footer className="form-footer">ESPACIO X <span>Hecho para continuar.</span></footer>
    </section>
  </main>;
}

function ProtectedPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = 'Página X · Espacio X';
    const controller = new AbortController();
    setError('');
    request('/api/x', { signal: controller.signal }).then(setData).catch(error => {
      if (error.name === 'AbortError') return;
      if (error.status === 401) window.location.replace('/');
      else setError(error.message);
    });
    return () => controller.abort();
  }, [attempt]);

  return <div className="protected-layout"><header className="page-header"><Brand /><span className="session-label"><span className="little-dot" />{data ? 'Sesión activa' : 'Verificando sesión'}</span></header><main className="welcome-main">
    {!data && !error && <div className="loading-state" role="status"><span className="spinner" aria-hidden="true" /><p>Preparando tu espacio…</p></div>}
    {error && <div className="welcome-card"><span className="form-eyebrow">INTENTEMOS OTRA VEZ</span><h1>No pudimos abrir tu espacio</h1><p className="error-message" role="alert">{error}</p><button className="primary-button" onClick={() => setAttempt(attempt + 1)}>Volver a intentar<Arrow /></button></div>}
    {data && <div className="welcome-card"><span className="welcome-icon" aria-hidden="true">✳</span><span className="form-eyebrow">YA ESTÁS DENTRO</span><h1>{data.message}</h1><p>Hola, <strong>{data.user.name}</strong>. Has llegado a tu espacio personal.</p><div className="profile-summary"><span className="avatar" aria-hidden="true">{data.user.name.slice(0, 1).toUpperCase()}</span><div><strong>{data.user.name}</strong><span>{data.user.email}</span></div><span className="verified-label">Conectado</span></div><p className="welcome-footnote">Este es el inicio de lo que viene.</p></div>}
  </main><footer className="page-footer">ESPACIO X · Tu próximo paso comienza aquí.</footer></div>;
}

export default function App() {
  return window.location.pathname.replace(/\/$/, '') === '/x' ? <ProtectedPage /> : <LoginPage />;
}
