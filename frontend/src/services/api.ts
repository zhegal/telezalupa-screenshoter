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

export type ChannelSource = 'json' | 'database';

export interface WorkerStatus {
  running: boolean;
  busy: boolean;
  lastStartedAt: string | null;
  lastStoppedAt: string | null;
  lastRestartedAt: string | null;
  lastCycleStartedAt: string | null;
  lastCycleFinishedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  nextRunAt: string | null;
  currentPlaylistUrl: string | null;
  currentChannelTitle: string | null;
  lastPlaylistUrl: string | null;
  lastChannelTitle: string | null;
  lastTelegramSentAt: string | null;
  lastTelegramMessageId: number | null;
  cyclesCount: number;
  successCount: number;
  errorCount: number;
  source: ChannelSource;
  activeChannelSource: ChannelSource;
  jsonSourceAvailable: boolean;
  databaseSourceAvailable: boolean;
  databaseSourceImplemented: boolean;
}

export interface WorkerActionResponse {
  status: 'started' | 'stopped' | 'busy' | 'completed' | 'ignored';
  worker: WorkerStatus;
}

export interface SystemStatus {
  status: string;
  source: ChannelSource;
  activeChannelSource: ChannelSource;
  jsonSourceAvailable: boolean;
  databaseSourceAvailable: boolean;
  databaseSourceImplemented: boolean;
  uptimeSeconds: number;
  nodeVersion: string;
  now: string;
  worker: WorkerStatus;
}

export interface JsonSourceStatus {
  path: string;
  exists: boolean;
  valid: boolean;
  sourceAvailable: boolean;
  sourceCount: number;
  error: string | null;
}

export interface DatabaseSourceStatus {
  implemented: false;
  sourceAvailable: true;
  playlistCount: number;
  channelCount: number;
  streamCount: number;
  providerCount: number;
}

export interface SourceSettingsStatus {
  activeChannelSource: ChannelSource;
  json: JsonSourceStatus;
  database: DatabaseSourceStatus;
  databaseSourceImplemented: false;
}

export interface JsonFileResponse {
  status: JsonSourceStatus;
  content: string | null;
}

export interface JsonFileSaveResponse {
  status: JsonSourceStatus;
  backupPath: string | null;
}

export interface JsonFileDeleteResponse {
  status: JsonSourceStatus;
  backupPath: string | null;
  switchedToDatabase: boolean;
  worker: WorkerActionResponse;
}

export interface SourceSwitchResponse {
  status: SourceSettingsStatus;
  worker: WorkerActionResponse;
}

export interface RuntimePlaylist {
  url: string;
  loaded: boolean;
  loading: boolean;
  channelsCount: number;
  availableChannelsCount: number;
  queueLeft: number;
  lastLoadedAt: string | null;
  lastLoadError: string | null;
}

export interface RuntimeChannel {
  playlistUrl: string;
  title: string;
  description: string;
  url: string;
  availableNow: boolean;
  scale: string;
  delay: number | null;
  userAgent: string;
  timezones: [string, string][] | null;
  available: { start: string; end: string }[] | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
}

export interface RuntimeListResponse<T> {
  source: 'json';
  items: T[];
}

export interface RuntimeLogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  scope: 'worker' | 'playlist' | 'channel' | 'ffmpeg' | 'telegram' | 'auth' | 'system';
  message: string;
  context?: Record<string, unknown>;
  createdAt: string;
}

export interface LogsResponse {
  items: RuntimeLogEntry[];
}

export type CatalogEntity =
  | 'providers'
  | 'streams'
  | 'channels'
  | 'playlists'
  | 'timezones'
  | 'telegram-chats'
  | 'caption-templates';

export interface CatalogItem {
  id: string;
  title?: string;
  enabled?: boolean;
  priority?: number;
  [key: string]: unknown;
}

export interface CatalogListResponse<T = CatalogItem> {
  items: T[];
}

export interface BulkOperationStats {
  requested: number;
  created?: number;
  deleted?: number;
  updated?: number;
  skipped: number;
  failed: number;
}

export interface StreamTransformPreviewItem {
  streamId: string;
  directUrl: string | null;
  streamKey: string | null;
  providerId: string | null;
  valid: boolean;
  error?: string;
}

export interface ImportProviderCandidate {
  providerId: string;
  title: string;
  streamKey: string;
  suggested: boolean;
}

export interface ImportPreviewRow {
  rowId: string;
  title: string;
  description: string;
  originalUrl: string;
  importMode: 'directUrl' | 'providerSuggestion' | 'skip';
  providerCandidates: ImportProviderCandidate[];
  selectedProviderId: string | null;
  computedStreamKey: string | null;
  timezones: Array<{ timezone: string; label: string; existing: boolean }>;
  scale: string;
  delay: number | null;
  userAgent: string;
  valid: boolean;
  errors: string[];
}

export interface ImportPreviewResponse {
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    channelsToCreate: number;
    streamsToCreate: number;
    playlistLinksToCreate: number;
    timezonePresetsToReuse: number;
    timezonePresetsToCreate: number;
    providerSuggestionsCount: number;
    directUrlStreamsCount: number;
    skippedDuplicatesCount: number;
  };
  rows: ImportPreviewRow[];
}

export interface ImportWizardPayload {
  sourceType: 'paste' | 'existingSource';
  json?: string;
  sourceUrl?: string;
  targetMode: 'newPlaylist' | 'existingPlaylist';
  playlistId?: string;
  playlistTitle?: string;
  skipExactDuplicates: boolean;
}

export interface ImportApplyResult {
  playlistId: string | null;
  createdPlaylist: boolean;
  createdChannels: number;
  createdStreams: number;
  createdPlaylistLinks: number;
  createdChannelStreamLinks: number;
  createdTimezonePresets: number;
  reusedTimezonePresets: number;
  skipped: number;
  failed: number;
}

interface ApiFetchOptions extends RequestInit {
  redirectOnUnauthorized?: boolean;
}

async function apiFetch<T>(url: string, init: ApiFetchOptions = {}): Promise<T> {
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

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/health');
}

export async function getBootstrapStatus(): Promise<BootstrapStatus> {
  return apiFetch<BootstrapStatus>('/api/auth/bootstrap-status', { redirectOnUnauthorized: false });
}

export async function login(payload: LoginPayload): Promise<AuthStateResponse> {
  return apiFetch<AuthStateResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
    redirectOnUnauthorized: false,
  });
}

export async function getMe(): Promise<AuthStateResponse> {
  return apiFetch<AuthStateResponse>('/api/auth/me', { redirectOnUnauthorized: false });
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
    redirectOnUnauthorized: false,
  });
}

export async function getSystemStatus(): Promise<SystemStatus> {
  return apiFetch<SystemStatus>('/api/system/status');
}

export async function getWorkerStatus(): Promise<WorkerStatus> {
  return apiFetch<WorkerStatus>('/api/worker/status');
}

export async function startWorker(): Promise<WorkerActionResponse> {
  return apiFetch<WorkerActionResponse>('/api/worker/start', { method: 'POST' });
}

export async function stopWorker(): Promise<WorkerActionResponse> {
  return apiFetch<WorkerActionResponse>('/api/worker/stop', { method: 'POST' });
}

export async function restartWorker(): Promise<WorkerActionResponse> {
  return apiFetch<WorkerActionResponse>('/api/worker/restart', { method: 'POST' });
}

export async function runWorkerOnce(): Promise<WorkerActionResponse> {
  return apiFetch<WorkerActionResponse>('/api/worker/run-once', { method: 'POST' });
}

export async function getSourceSettingsStatus(): Promise<SourceSettingsStatus> {
  return apiFetch<SourceSettingsStatus>('/api/settings/sources/status');
}

export async function setActiveSource(source: ChannelSource): Promise<SourceSwitchResponse> {
  return apiFetch<SourceSwitchResponse>('/api/settings/sources/active', {
    method: 'PATCH',
    body: JSON.stringify({ source }),
  });
}

export async function getJsonSourceFile(): Promise<JsonFileResponse> {
  return apiFetch<JsonFileResponse>('/api/settings/sources/json-file');
}

export async function saveJsonSourceFile(content: string): Promise<JsonFileSaveResponse> {
  return apiFetch<JsonFileSaveResponse>('/api/settings/sources/json-file', {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export async function deleteJsonSourceFile(): Promise<JsonFileDeleteResponse> {
  return apiFetch<JsonFileDeleteResponse>('/api/settings/sources/json-file', {
    method: 'DELETE',
  });
}

export async function getRuntimePlaylists(): Promise<RuntimeListResponse<RuntimePlaylist>> {
  return apiFetch<RuntimeListResponse<RuntimePlaylist>>('/api/runtime/playlists');
}

export async function getRuntimeChannels(): Promise<RuntimeListResponse<RuntimeChannel>> {
  return apiFetch<RuntimeListResponse<RuntimeChannel>>('/api/runtime/channels');
}

export async function getRecentLogs(params: { scope?: RuntimeLogEntry['scope']; limit?: number } = {}): Promise<LogsResponse> {
  const query = new URLSearchParams();

  if (params.scope) {
    query.set('scope', params.scope);
  }

  if (params.limit) {
    query.set('limit', String(params.limit));
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiFetch<LogsResponse>(`/api/logs/recent${suffix}`);
}

export async function listCatalog<T = CatalogItem>(
  entity: CatalogEntity,
  params: { search?: string; enabled?: string; limit?: number; offset?: number } = {},
): Promise<CatalogListResponse<T>> {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  }

  return apiFetch<CatalogListResponse<T>>(`/api/catalog/${entity}${query.toString() ? `?${query}` : ''}`);
}

export async function createCatalog<T = CatalogItem>(
  entity: CatalogEntity,
  payload: Record<string, unknown>,
): Promise<T> {
  return apiFetch<T>(`/api/catalog/${entity}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCatalog<T = CatalogItem>(
  entity: CatalogEntity,
  id: string,
  payload: Record<string, unknown>,
): Promise<T> {
  return apiFetch<T>(`/api/catalog/${entity}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteCatalog(entity: CatalogEntity, id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/catalog/${entity}/${id}`, {
    method: 'DELETE',
  });
}

export async function listCatalogRelation<T = CatalogItem>(path: string): Promise<CatalogListResponse<T>> {
  return apiFetch<CatalogListResponse<T>>(`/api/catalog/${path}`);
}

export async function createCatalogRelation<T = CatalogItem>(
  path: string,
  payload: Record<string, unknown>,
): Promise<T> {
  return apiFetch<T>(`/api/catalog/${path}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCatalogRelation<T = CatalogItem>(
  path: string,
  relationId: string,
  payload: Record<string, unknown>,
): Promise<T> {
  return apiFetch<T>(`/api/catalog/${path}/${relationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteCatalogRelation(path: string, relationId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/catalog/${path}/${relationId}`, {
    method: 'DELETE',
  });
}

export async function bulkAttachPlaylistChannels(
  playlistId: string,
  channelIds: string[],
): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>(`/api/catalog/playlists/${playlistId}/channels/bulk-attach`, {
    method: 'POST',
    body: JSON.stringify({ channelIds }),
  });
}

export async function bulkDetachPlaylistChannels(
  playlistId: string,
  channelIds: string[],
): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>(`/api/catalog/playlists/${playlistId}/channels/bulk-detach`, {
    method: 'POST',
    body: JSON.stringify({ channelIds }),
  });
}

export async function bulkAttachChannelStreams(
  channelId: string,
  streamIds: string[],
): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>(`/api/catalog/channels/${channelId}/streams/bulk-attach`, {
    method: 'POST',
    body: JSON.stringify({ streamIds }),
  });
}

export async function bulkDetachChannelStreams(
  channelId: string,
  streamIds: string[],
): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>(`/api/catalog/channels/${channelId}/streams/bulk-detach`, {
    method: 'POST',
    body: JSON.stringify({ streamIds }),
  });
}

export async function bulkAssignStreamProvider(
  streamIds: string[],
  providerId: string,
): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>('/api/catalog/streams/bulk-provider-assign', {
    method: 'POST',
    body: JSON.stringify({ streamIds, providerId }),
  });
}

export async function bulkSetStreamsEnabled(
  streamIds: string[],
  enabled: boolean,
): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>(`/api/catalog/streams/${enabled ? 'bulk-enable' : 'bulk-disable'}`, {
    method: 'POST',
    body: JSON.stringify({ streamIds }),
  });
}

export async function previewStreamTransform(payload: {
  streamIds: string[];
  providerId: string;
  prefixToStrip: string;
  suffixToStrip: string;
}): Promise<StreamTransformPreviewItem[]> {
  return apiFetch<StreamTransformPreviewItem[]>('/api/catalog/streams/bulk-transform-preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function applyStreamTransform(payload: {
  streamIds: string[];
  providerId: string;
  prefixToStrip: string;
  suffixToStrip: string;
}): Promise<BulkOperationStats> {
  return apiFetch<BulkOperationStats>('/api/catalog/streams/bulk-transform-apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getImportSources(): Promise<{ items: string[] }> {
  return apiFetch<{ items: string[] }>('/api/catalog/import/sources');
}

export async function previewCatalogImport(payload: ImportWizardPayload): Promise<ImportPreviewResponse> {
  return apiFetch<ImportPreviewResponse>('/api/catalog/import/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function applyCatalogImport(
  payload: ImportWizardPayload & { rows: Array<{ rowId: string; selectedProviderId: string | null }> },
): Promise<ImportApplyResult> {
  return apiFetch<ImportApplyResult>('/api/catalog/import/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
