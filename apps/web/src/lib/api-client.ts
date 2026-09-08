const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

let cachedCsrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  const res = await fetch(`${API_BASE_URL}/auth/csrf`, { credentials: 'include' });
  const body = await res.json();
  cachedCsrfToken = body.csrfToken;
  return cachedCsrfToken!;
}

/** Call after any request that changes the session (login/logout) — the CSRF token
 * is bound to the session identifier and goes stale when the session is regenerated. */
export function invalidateCsrfToken() {
  cachedCsrfToken = null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  if (MUTATING_METHODS.has(method)) {
    headers.set('X-CSRF-Token', await getCsrfToken());
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    method,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
