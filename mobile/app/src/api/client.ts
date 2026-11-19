import { API_BASE_URL } from '../constants/config';
import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken, clearTokens } from '../lib/storage';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message || `Request failed: ${status}`);
    this.status = status;
    this.body = body;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const rt = await getRefreshToken();
  if (!rt) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newAccess = data?.token || data?.access_token;
    const newRefresh = data?.refresh_token;
    if (newAccess) await setAccessToken(newAccess);
    if (newRefresh) await setRefreshToken(newRefresh);
    return newAccess || null;
  } catch {
    return null;
  }
}

export async function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
  retry?: boolean;
}

export async function apiFetch<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const { skipAuth, retry = true, ...init } = options;
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (!skipAuth) {
    const token = await getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401 && !skipAuth && retry) {
    const newToken = await refreshOnce();
    if (newToken) {
      return apiFetch<T>(path, { ...options, retry: false });
    }
    await clearTokens();
    throw new ApiError(401, null, 'Session expired');
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!res.ok) {
    const msg = (body as any)?.message || (body as any)?.detail || (body as any)?.error || `Request failed: ${res.status}`;
    throw new ApiError(res.status, body, msg);
  }
  return body as T;
}

// Auth helpers
export async function login(username: string, password: string): Promise<{ token: string; refresh_token?: string; user: any }> {
  const data = await apiFetch<any>('/api/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ username, password, client: 'mobile' }),
  });
  if (data?.status === 'error') {
    throw new ApiError(401, data, data?.message || 'Login failed');
  }
  const token = data?.token;
  const refreshToken = data?.refresh_token;
  if (token) await setAccessToken(token);
  if (refreshToken) await setRefreshToken(refreshToken);
  return { token, refresh_token: refreshToken, user: data?.user };
}

export async function logout(): Promise<void> {
  try {
    const rt = await getRefreshToken();
    await apiFetch('/api/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: rt }),
    });
  } catch {
    // ignore
  }
  await clearTokens();
}

export async function me() {
  return apiFetch<any>('/api/me');
}

// Changing the password revokes every other session server-side and hands back a
// fresh access token for this one. The stored refresh token is revoked with the
// rest, so it is dropped here rather than left to fail later.
export async function changePassword(currentPassword: string, newPassword: string): Promise<string | null> {
  const data = await apiFetch<any>('/api/me/password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  const token = data?.token || null;
  if (token) await setAccessToken(token);
  await setRefreshToken(null);
  return token;
}