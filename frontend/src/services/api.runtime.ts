import { apiFetch } from './api-client';
import type { RuntimeChannel, RuntimeListResponse, RuntimePlaylist } from './api.types';

export function getRuntimePlaylists(): Promise<RuntimeListResponse<RuntimePlaylist>> {
  return apiFetch<RuntimeListResponse<RuntimePlaylist>>('/api/runtime/playlists');
}

export function getRuntimeChannels(
  params: { search?: string; filter?: string; enabled?: string; limit?: number; offset?: number } = {},
): Promise<RuntimeListResponse<RuntimeChannel>> {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  }

  return apiFetch<RuntimeListResponse<RuntimeChannel>>(`/api/runtime/channels${query.toString() ? `?${query}` : ''}`);
}
