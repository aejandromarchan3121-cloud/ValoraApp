import { supabase } from '../supabase';

const BASE = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Cliente del backend FastAPI. Adjunta el JWT de Supabase; el backend lo valida. */
export async function api(path, { method = 'GET', body, idempotencyKey } = {}) {
  if (!BASE) throw new ApiError(0, 'NO_API_URL', 'Falta VITE_API_URL en el .env');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'No se pudo conectar con el servidor. Revisa tu conexión.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? 'ERROR', json?.error?.message ?? 'Error inesperado.');
  return json;
}
