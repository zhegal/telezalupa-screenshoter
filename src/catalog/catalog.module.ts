import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  CatalogChannelStreamsController,
  CatalogChannelTimezonesController,
  CatalogController,
  CatalogPlaylistChannelsController,
  CatalogPlaylistTimezonesController,
} from './catalog.controller.js';
import { CatalogImportController } from './catalog-import.controller.js';
import { CatalogImportService } from './catalog-import.service.js';
import { CatalogService } from './catalog.service.js';
import { PlaylistsModule } from '../playlists/playlists.module.js';

@Module({
  imports: [AuthModule, PlaylistsModule],
  controllers: [
    CatalogImportController,
    CatalogController,
    CatalogPlaylistChannelsController,
    CatalogChannelStreamsController,
    CatalogChannelTimezonesController,
    CatalogPlaylistTimezonesController,
  ],
  providers: [CatalogService, CatalogImportService],
})
export class CatalogModule {}
