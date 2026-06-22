import { apiFetch } from './api-client';
import type { BulkOperationStats, StreamTransformPreviewItem } from './api.types';

type TransformPayload = {
  streamIds: string[];
  providerId: string;
  prefixToStrip: string;
  suffixToStrip: string;
};

export function bulkAttachPlaylistChannels(
  playlistId: string,
  channelIds: string[],
): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>(`/api/catalog/playlists/${playlistId}/channels/bulk-attach`, {
    method: 'POST',
    body: JSON.stringify({ channelIds }),
  });
}

export function bulkDetachPlaylistChannels(
  playlistId: string,
  channelIds: string[],
): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>(`/api/catalog/playlists/${playlistId}/channels/bulk-detach`, {
    method: 'POST',
    body: JSON.stringify({ channelIds }),
  });
}

export function bulkAttachChannelStreams(channelId: string, streamIds: string[]): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>(`/api/catalog/channels/${channelId}/streams/bulk-attach`, {
    method: 'POST',
    body: JSON.stringify({ streamIds }),
  });
}

export function bulkDetachChannelStreams(channelId: string, streamIds: string[]): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>(`/api/catalog/channels/${channelId}/streams/bulk-detach`, {
    method: 'POST',
    body: JSON.stringify({ streamIds }),
  });
}

export function bulkAssignStreamProvider(streamIds: string[], providerId: string): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>('/api/catalog/streams/bulk-provider-assign', {
    method: 'POST',
    body: JSON.stringify({ streamIds, providerId }),
  });
}

export function bulkSetStreamsEnabled(streamIds: string[], enabled: boolean): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>(`/api/catalog/streams/${enabled ? 'bulk-enable' : 'bulk-disable'}`, {
    method: 'POST',
    body: JSON.stringify({ streamIds }),
  });
}

export function previewStreamTransform(payload: TransformPayload): Promise<StreamTransformPreviewItem[]> {
  return apiFetch<StreamTransformPreviewItem[]>('/api/catalog/streams/bulk-transform-preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function applyStreamTransform(payload: TransformPayload): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>('/api/catalog/streams/bulk-transform-apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
