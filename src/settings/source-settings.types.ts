export type ChannelSource = 'json' | 'database';

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

export interface SourceStatus {
  activeChannelSource: ChannelSource;
  json: JsonSourceStatus;
  database: DatabaseSourceStatus;
  databaseSourceImplemented: false;
}

export interface JsonFileResponse {
  status: JsonSourceStatus;
  content: string | null;
}

export interface JsonFileSaveResult {
  status: JsonSourceStatus;
  backupPath: string | null;
}

export interface JsonFileDeleteResult {
  status: JsonSourceStatus;
  backupPath: string | null;
  switchedToDatabase: boolean;
}
