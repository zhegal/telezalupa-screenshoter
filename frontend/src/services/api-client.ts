interface ApiFetchOptions extends RequestInit {
  redirectOnUnauthorized?: boolean;
}

export async function apiFetch<T>(url: string, init: ApiFetchOptions = {}): Promise<T> {
  const { redirectOnUnauthorized = true, ...requestInit } = init;
  const response = await fetch(url, {
    credentials: 'include',
    ...requestInit,
    headers: {
      Accept: 'application/json',
      ...(requestInit.body ? { 'Content-Type': 'application/json' } : {}),
      ...requestInit.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.message || `Request failed: ${response.status}`;

    if (response.status === 401 && redirectOnUnauthorized && !['/login', '/setup'].includes(window.location.pathname)) {
      window.location.assign('/login');
    }

    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  return response.json();
}
