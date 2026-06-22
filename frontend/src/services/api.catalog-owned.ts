import { apiFetch } from './api-client';
import type { BulkOperationStats, CatalogItem } from './api.types';

export function createPlaylistOwnedChannel(playlistId: string, payload: Record<string, unknown>): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/api/catalog/playlists/${playlistId}/channels/owned`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deletePlaylistOwnedChannel(playlistId: string, channelId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/catalog/playlists/${playlistId}/channels/${channelId}/owned`, {
    method: 'DELETE',
  });
}

export function bulkDeletePlaylistOwnedChannels(
  playlistId: string,
  channelIds: string[],
): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>(`/api/catalog/playlists/${playlistId}/channels/bulk-delete-owned`, {
    method: 'POST',
    body: JSON.stringify({ channelIds }),
  });
}

export function copyPlaylistOwnedChannel(
  playlistId: string,
  channelId: string,
  targetPlaylistId: string,
): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/api/catalog/playlists/${playlistId}/channels/${channelId}/copy`, {
    method: 'POST',
    body: JSON.stringify({ targetPlaylistId }),
  });
}

export function movePlaylistOwnedChannel(
  playlistId: string,
  channelId: string,
  targetPlaylistId: string,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/catalog/playlists/${playlistId}/channels/${channelId}/move`, {
    method: 'POST',
    body: JSON.stringify({ targetPlaylistId }),
  });
}

export function createChannelOwnedStream(channelId: string, payload: Record<string, unknown>): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/api/catalog/channels/${channelId}/streams/owned`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteChannelOwnedStream(channelId: string, streamId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/catalog/channels/${channelId}/streams/${streamId}/owned`, {
    method: 'DELETE',
  });
}
