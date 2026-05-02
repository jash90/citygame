const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

let refreshPromise: Promise<boolean> | null = null;

/**
 * BroadcastChannel to coordinate token refresh across browser tabs.
 * When one tab refreshes, it notifies others so they don't fire redundant
 * refresh requests (which would fail due to DB token rotation).
 */
const refreshChannel =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('citygame:auth-refresh')
    : null;

if (refreshChannel) {
  refreshChannel.onmessage = (event) => {
    if (event.data === 'refreshed') {
      // Another tab refreshed successfully — our cookies are already updated.
    }
  };
}

/**
 * Attempt to refresh the access token using httpOnly cookies.
 */
export async function tryRefreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    if (res.ok) {
      refreshChannel?.postMessage('refreshed');
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function handleUnauthorized(): never {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('userRole');
    window.location.href = '/login';
  }
  throw new Error('Unauthorized');
}

export interface RequestOptions {
  /**
   * Skip the automatic token-refresh + redirect-to-login flow on 401.
   * Use for auth endpoints (login, register) where a 401 means
   * "invalid credentials", not "expired session".
   */
  skipAuthRedirect?: boolean;
}

/**
 * Core fetch wrapper. Authentication is handled via httpOnly cookies
 * sent automatically by the browser (`credentials: 'include'`).
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
  requestOptions?: RequestOptions,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));

  if (requestOptions?.skipAuthRedirect) {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Server error' }));
      throw new Error(error.message ?? `HTTP ${response.status}`);
    }
  } else {
    if (response.status === 401 && !isRetry) {
      if (!refreshPromise) {
        refreshPromise = tryRefreshToken().finally(() => {
          refreshPromise = null;
        });
      }

      const refreshed = await refreshPromise;

      if (refreshed) {
        return request<T>(path, options, true, requestOptions);
      }

      handleUnauthorized();
    }

    if (response.status === 401) {
      handleUnauthorized();
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Server error' }));
      throw new Error(error.message ?? `HTTP ${response.status}`);
    }
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const json = await response.json();
  // Backend wraps responses in { data, message } via TransformInterceptor
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

export const api = {
  get<T>(path: string, opts?: RequestOptions): Promise<T> {
    return request<T>(path, { method: 'GET' }, false, opts);
  },

  post<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }, false, opts);
  },

  patch<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }, false, opts);
  },

  delete<T>(path: string, opts?: RequestOptions): Promise<T> {
    return request<T>(path, { method: 'DELETE' }, false, opts);
  },
};
