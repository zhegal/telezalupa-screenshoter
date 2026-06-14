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
