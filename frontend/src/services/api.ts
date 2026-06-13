export interface HealthResponse {
  status: string;
}

export interface BootstrapStatus {
  hasUsers: boolean;
  tempAdminPasswordConfigured: boolean;
  bootstrapAvailable: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: 'admin';
  telegramId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthStateResponse {
  authenticated?: boolean;
  user: AuthUser | null;
  isBootstrap: boolean;
}

export interface LoginPayload {
  login: string;
  password: string;
}

export interface SetupPayload {
  email: string;
  username: string;
  password: string;
  displayName?: string;
  telegramId?: string;
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.message || `Request failed: ${response.status}`;

    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  return response.json();
}

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/health');
}

export async function getBootstrapStatus(): Promise<BootstrapStatus> {
  return apiFetch<BootstrapStatus>('/api/auth/bootstrap-status');
}

export async function login(payload: LoginPayload): Promise<AuthStateResponse> {
  return apiFetch<AuthStateResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMe(): Promise<AuthStateResponse> {
  return apiFetch<AuthStateResponse>('/api/auth/me');
}

export async function logout(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
  });
}

export async function setupFirstUser(payload: SetupPayload): Promise<AuthStateResponse> {
  return apiFetch<AuthStateResponse>('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
