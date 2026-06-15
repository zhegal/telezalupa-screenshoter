import type { ChannelTimezone } from '../channels/channel.types.js';

export type ImportSourceType = 'paste' | 'existingSource';
export type ImportTargetMode = 'newPlaylist' | 'existingPlaylist';

export interface ImportPreviewRequest {
  sourceType: ImportSourceType;
  json?: string;
  sourceUrl?: string;
  targetMode: ImportTargetMode;
  playlistId?: string;
  playlistTitle?: string;
  skipExactDuplicates?: boolean;
}

export interface ImportApplyRequest extends ImportPreviewRequest {
  rows?: Array<{
    rowId: string;
    selectedProviderId?: string | null;
  }>;
}

export interface ImportProviderCandidate {
  providerId: string;
  title: string;
  streamKey: string;
  suggested: boolean;
}

export interface ImportTimezonePreview {
  timezone: string;
  label: string;
  existing: boolean;
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
  timezones: ImportTimezonePreview[];
  scale: string;
  delay: number | null;
  userAgent: string;
  valid: boolean;
  errors: string[];
}

export interface ImportPreviewSummary {
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
}

export interface ImportPreviewResponse {
  summary: ImportPreviewSummary;
  rows: ImportPreviewRow[];
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

export type NormalizedTimezone = ChannelTimezone;
