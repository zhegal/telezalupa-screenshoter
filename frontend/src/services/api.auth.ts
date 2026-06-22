import { apiFetch } from './api-client';
import type { AuthStateResponse, BootstrapStatus, HealthResponse, LoginPayload, SetupPayload } from './api.types';

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/health');
}

export function getBootstrapStatus(): Promise<BootstrapStatus> {
  return apiFetch<BootstrapStatus>('/api/auth/bootstrap-status', { redirectOnUnauthorized: false });
}

export function login(payload: LoginPayload): Promise<AuthStateResponse> {
  return apiFetch<AuthStateResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
    redirectOnUnauthorized: false,
  });
}

export function getMe(): Promise<AuthStateResponse> {
  return apiFetch<AuthStateResponse>('/api/auth/me', { redirectOnUnauthorized: false });
}

export function logout(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export function setupFirstUser(payload: SetupPayload): Promise<AuthStateResponse> {
  return apiFetch<AuthStateResponse>('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify(payload),
    redirectOnUnauthorized: false,
  });
}
