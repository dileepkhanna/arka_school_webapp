// Prefer an explicit API base URL. In production, default to same-origin
// `/api`, which matches the Hostinger/Apache rewrite setup in this repo.
// In development, use an empty string so requests go through the Vite proxy.
const _envUrl = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL = _envUrl && _envUrl.trim() !== ''
  ? _envUrl.trim().replace(/\/$/, '')
  : (import.meta.env.PROD ? `${window.location.origin}/api` : '');

const TOKEN_KEY = 'ase_api_token';

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

function getApiBaseUrlCandidates(): string[] {
  const candidates = [API_BASE_URL];

  if (import.meta.env.PROD && typeof window !== 'undefined') {
    const origin = window.location.origin;
    const normalizedApiOrigin = API_BASE_URL.replace(/\/api$/, '');

    // If production was built against the site root, retry through `/api`
    // when the root path is serving SPA HTML instead of Laravel JSON.
    if (normalizedApiOrigin === origin && API_BASE_URL === origin) {
      candidates.push(`${origin}/api`);
    }
  }

  return [...new Set(candidates)];
}

export type ApiUser = {
  id: number;
  email: string;
  name: string;
  profile?: {
    full_name?: string;
    phone?: string;
    photo_url?: string;
  };
  role?: {
    role: 'admin' | 'teacher' | 'parent';
  };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiValidationError';
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }

  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();

  const headers: HeadersInit = {
    ...(init.headers || {}),
  };

  const isFormData = init.body instanceof FormData;
  if (!isFormData) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  let lastError: Error | null = null;

  for (const baseUrl of getApiBaseUrlCandidates()) {
    // Abort after 60s so the UI never hangs indefinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      lastError = new Error(isAbort ? 'Request timed out. Please try again.' : 'Network error. Check your connection.');
      continue;
    }
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const body = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      if (response.status === 422 && isJson && typeof body === 'object' && body && 'errors' in body) {
        throw new ApiValidationError(
          (body as any).message || 'Validation failed',
          (body as any).errors as Record<string, string[]>,
        );
      }
      const errorMessage = isJson && typeof body === 'object' && body && 'message' in body
        ? String(body.message)
        : `Request failed (${response.status})`;
      lastError = new ApiError(errorMessage, response.status);
      continue;
    }

    if (!isJson) {
      lastError = new Error('API returned a non-JSON response');
      continue;
    }

    return body as T;
  }

  throw lastError ?? new Error('Request failed');
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(payload ?? {}) }),
  postForm: <T>(path: string, payload: FormData) =>
    request<T>(path, { method: 'POST', body: payload }),
  put: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(payload ?? {}) }),
  delete: <T>(path: string, payload?: unknown) =>
    request<T>(path, payload === undefined ? { method: 'DELETE' } : { method: 'DELETE', body: JSON.stringify(payload) }),
};
