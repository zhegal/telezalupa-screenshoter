export const WORKER_CONFIG = Symbol('WORKER_CONFIG');

export interface WorkerConfig {
  intervalMs: number;
  retryIntervalMs: number;
  errorRetryIntervalMs: number;
}

export function createWorkerConfig(): WorkerConfig {
  return {
    intervalMs: 45000,
    retryIntervalMs: 5000,
    errorRetryIntervalMs: 1000,
  };
}
