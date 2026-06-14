import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  CatalogChannelStreamsController,
  CatalogChannelTimezonesController,
  CatalogController,
  CatalogPlaylistChannelsController,
  CatalogPlaylistTimezonesController,
} from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    CatalogController,
    CatalogPlaylistChannelsController,
    CatalogChannelStreamsController,
    CatalogChannelTimezonesController,
    CatalogPlaylistTimezonesController,
  ],
  providers: [CatalogService],
})
export class CatalogModule {}
