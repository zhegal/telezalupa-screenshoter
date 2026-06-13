import { join } from 'node:path';

export const PLAYLIST_CONFIG = Symbol('PLAYLIST_CONFIG');

export interface PlaylistConfig {
  filePath: string;
  requestTimeoutMs: number;
  defaultScale: string;
  defaultDelaySeconds: number;
  defaultTimezones: [string, string][];
}

export function createPlaylistConfig(): PlaylistConfig {
  return {
    filePath: join(process.cwd(), 'data', 'playlists.json'),
    requestTimeoutMs: 15000,
    defaultScale: '1280:720',
    defaultDelaySeconds: 45,
    defaultTimezones: [['Europe/Moscow', 'UTC+3']],
  };
}
