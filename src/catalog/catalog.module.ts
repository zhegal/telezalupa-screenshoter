import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CaptionsModule } from '../captions/captions.module.js';
import { CaptureModule } from '../capture/capture.module.js';
import { LogsModule } from '../logs/logs.module.js';
import { PlaylistsModule } from '../playlists/playlists.module.js';
import { TelegramModule } from '../telegram/telegram.module.js';
import {
  CatalogChannelStreamsController,
  CatalogChannelTimezonesController,
  CatalogController,
  CatalogPlaylistChannelsController,
  CatalogPlaylistTimezonesController,
} from './catalog.controller.js';
import { CatalogImportController } from './catalog-import.controller.js';
import { CatalogImportService } from './catalog-import.service.js';
import { CatalogManualScreenshotService } from './catalog-manual-screenshot.service.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [AuthModule, CaptionsModule, CaptureModule, LogsModule, PlaylistsModule, TelegramModule],
  controllers: [
    CatalogImportController,
    CatalogController,
    CatalogPlaylistChannelsController,
    CatalogChannelStreamsController,
    CatalogChannelTimezonesController,
    CatalogPlaylistTimezonesController,
  ],
  providers: [CatalogService, CatalogImportService, CatalogManualScreenshotService],
})
export class CatalogModule {}
