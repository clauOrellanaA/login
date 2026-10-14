export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, { credentials: 'same-origin', ...options });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.', 0);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('El servidor no pudo completar la solicitud. Inténtalo de nuevo.', response.status);
  }
  if (!response.ok) throw new ApiError(data.error || 'No pudimos completar la solicitud.', response.status);
  return data;
}

export function login(email, password) {
  return request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}
