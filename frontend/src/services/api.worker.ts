import { apiFetch } from './api-client';
import type { SystemStatus, WorkerActionResponse, WorkerStatus } from './api.types';

export function getSystemStatus(): Promise<SystemStatus> {
  return apiFetch<SystemStatus>('/api/system/status');
}

export function getWorkerStatus(): Promise<WorkerStatus> {
  return apiFetch<WorkerStatus>('/api/worker/status');
}

export function startWorker(): Promise<WorkerActionResponse> {
  return apiFetch<WorkerActionResponse>('/api/worker/start', { method: 'POST' });
}

export function stopWorker(): Promise<WorkerActionResponse> {
  return apiFetch<WorkerActionResponse>('/api/worker/stop', { method: 'POST' });
}

export function restartWorker(): Promise<WorkerActionResponse> {
  return apiFetch<WorkerActionResponse>('/api/worker/restart', { method: 'POST' });
}

export function runWorkerOnce(): Promise<WorkerActionResponse> {
  return apiFetch<WorkerActionResponse>('/api/worker/run-once', { method: 'POST' });
}
