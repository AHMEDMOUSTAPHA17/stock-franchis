/**
 * Client API Service
 * Communicates with local server endpoints with JSON handling and auth headers
 */

let authToken: string | null = localStorage.getItem('gstock_token');

export function setApiToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('gstock_token', token);
  } else {
    localStorage.removeItem('gstock_token');
  }
}

export function getApiToken(): string | null {
  return authToken;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `خطأ في الاتصال بالخادم (${response.status})`);
  }

  return data as T;
}
