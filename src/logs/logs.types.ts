export type RuntimeLogLevel = 'info' | 'warn' | 'error';

export type RuntimeLogScope =
  | 'worker'
  | 'playlist'
  | 'channel'
  | 'ffmpeg'
  | 'telegram'
  | 'auth'
  | 'system';

export interface RuntimeLogEntry {
  id: string;
  level: RuntimeLogLevel;
  scope: RuntimeLogScope;
  message: string;
  context?: Record<string, unknown>;
  createdAt: string;
}
