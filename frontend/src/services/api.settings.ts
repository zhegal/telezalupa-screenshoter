import { apiFetch } from './api-client';
import type {
  ChannelSource,
  JsonFileDeleteResponse,
  JsonFileResponse,
  JsonFileSaveResponse,
  SourceSettingsStatus,
  SourceSwitchResponse,
} from './api.types';

export function getSourceSettingsStatus(): Promise<SourceSettingsStatus> {
  return apiFetch<SourceSettingsStatus>('/api/settings/sources/status');
}

export function setActiveSource(source: ChannelSource): Promise<SourceSwitchResponse> {
  return apiFetch<SourceSwitchResponse>('/api/settings/sources/active', {
    method: 'PATCH',
    body: JSON.stringify({ source }),
  });
}

export function getJsonSourceFile(): Promise<JsonFileResponse> {
  return apiFetch<JsonFileResponse>('/api/settings/sources/json-file');
}

export function saveJsonSourceFile(content: string): Promise<JsonFileSaveResponse> {
  return apiFetch<JsonFileSaveResponse>('/api/settings/sources/json-file', {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export function deleteJsonSourceFile(): Promise<JsonFileDeleteResponse> {
  return apiFetch<JsonFileDeleteResponse>('/api/settings/sources/json-file', { method: 'DELETE' });
}
