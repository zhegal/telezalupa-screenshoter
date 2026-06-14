export type CatalogEntity =
  | 'providers'
  | 'streams'
  | 'channels'
  | 'playlists'
  | 'timezones'
  | 'telegram-chats'
  | 'caption-templates';

export interface CatalogListQuery {
  search?: string;
  enabled?: string;
  limit?: string;
  offset?: string;
}

export interface CatalogRelationBody {
  streamId?: string;
  channelId?: string;
  timezonePresetId?: string;
  enabled?: boolean;
  priority?: number | string;
}

export interface BulkRelationBody {
  channelIds?: string[];
  streamIds?: string[];
}

export interface BulkStreamsBody {
  streamIds?: string[];
  providerId?: string;
  prefixToStrip?: string;
  suffixToStrip?: string;
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
