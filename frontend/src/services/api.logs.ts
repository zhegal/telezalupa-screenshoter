import { apiFetch } from './api-client';
import type { LogsResponse, RuntimeLogEntry } from './api.types';

export function getRecentLogs(
  params: { scope?: RuntimeLogEntry['scope']; limit?: number; offset?: number } = {},
): Promise<LogsResponse> {
  const query = new URLSearchParams();

  if (params.scope) query.set('scope', params.scope);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<LogsResponse>(`/api/logs/recent${suffix}`);
}
