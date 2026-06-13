import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, createAppConfig } from './app.config.js';
import { AUTH_CONFIG, createAuthConfig } from './auth.config.js';
import { FFMPEG_CONFIG, createFfmpegConfig } from './ffmpeg.config.js';
import { PLAYLIST_CONFIG, createPlaylistConfig } from './playlist.config.js';
import { TELEGRAM_CONFIG, createTelegramConfig } from './telegram.config.js';
import { WORKER_CONFIG, createWorkerConfig } from './worker.config.js';

@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: createAppConfig },
    { provide: AUTH_CONFIG, useFactory: createAuthConfig },
    { provide: FFMPEG_CONFIG, useFactory: createFfmpegConfig },
    { provide: PLAYLIST_CONFIG, useFactory: createPlaylistConfig },
    { provide: TELEGRAM_CONFIG, useFactory: createTelegramConfig },
    { provide: WORKER_CONFIG, useFactory: createWorkerConfig },
  ],
  exports: [APP_CONFIG, AUTH_CONFIG, FFMPEG_CONFIG, PLAYLIST_CONFIG, TELEGRAM_CONFIG, WORKER_CONFIG],
})
export class ConfigModule {}
