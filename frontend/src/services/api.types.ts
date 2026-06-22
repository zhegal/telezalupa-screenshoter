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
  implemented: boolean;
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
  databaseSourceImplemented: boolean;
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
  id?: string;
  title?: string;
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
  playlistId?: string;
  playlistTitle?: string;
  channelId?: string;
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
  source: ChannelSource;
  items: T[];
  total?: number;
  limit?: number;
  offset?: number;
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
  total: number;
  limit: number;
  offset: number;
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
  total: number;
  limit: number;
  offset: number;
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
