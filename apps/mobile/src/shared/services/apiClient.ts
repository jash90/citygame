import { API_URL, SECURE_STORE_KEYS } from '@/shared/lib/constants';
import * as SecureStore from 'expo-secure-store';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

interface ApiError {
  message: string;
  statusCode: number;
}

/**
 * Thrown when the request never reached the server (DNS failure, no
 * connectivity, etc.). Callers can use `instanceof NetworkError` to skip
 * "unauthorized" handling and instead enqueue the operation for retry.
 */
export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

class ApiClient {
  private baseUrl: string;
  private onUnauthorized?: () => void;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setUnauthorizedHandler(handler: () => void): void {
    this.onUnauthorized = handler;
  }

  private async getAuthToken(): Promise<string | null> {
    return SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
  }

  /**
   * Attempt to refresh the access token using the stored refresh token.
   * Deduplicates concurrent refresh attempts.
   */
  private async tryRefreshToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefreshToken().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async doRefreshToken(): Promise<boolean> {
    try {
      const refreshToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) return false;

      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const json = (await res.json()) as Record<string, unknown>;
      const data = (json?.data ?? json) as Record<string, unknown>;

      if (data?.accessToken) {
        await SecureStore.setItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN, data.accessToken as string);
        if (data.refreshToken) {
          await SecureStore.setItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN, data.refreshToken as string);
        }
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  private async request<T>(
    path: string,
    options: RequestOptions = {},
    isRetry = false,
  ): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;
    const token = await this.getAuthToken();

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    };

    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: requestHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      // `fetch` only throws for network errors (DNS, connection refused,
      // airplane mode). These must not trigger `onUnauthorized` — we want
      // the user to remain logged in while offline.
      const message = err instanceof Error ? err.message : 'Network request failed';
      throw new NetworkError(message);
    }

    if (response.status === 401 && !isRetry) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        return this.request<T>(path, options, true);
      }
      this.onUnauthorized?.();
      throw new Error('Unauthorized. Please log in again.');
    }

    if (response.status === 401) {
      this.onUnauthorized?.();
      throw new Error('Unauthorized. Please log in again.');
    }

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`;
      try {
        const errorData = (await response.json()) as ApiError;
        errorMessage = errorData.message ?? errorMessage;
      } catch {
        // ignore JSON parse errors on error responses
      }
      throw new Error(errorMessage);
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    const json = await response.json();
    // Backend wraps responses in { data, message } via TransformInterceptor
    if (json != null && typeof json === 'object' && 'data' in json) {
      return json.data as T;
    }
    return json as T;
  }

  get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, { method: 'GET', headers });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_URL);
