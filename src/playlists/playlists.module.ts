import { Module } from '@nestjs/common';
import { ChannelAvailabilityService } from '../channels/channel-availability.service.js';
import { ChannelTimeService } from '../channels/channel-time.service.js';
import { LogsModule } from '../logs/logs.module.js';
import { PlaylistLoaderService } from './playlist-loader.service.js';
import { PlaylistNormalizerService } from './playlist-normalizer.service.js';
import { PlaylistSelectorService } from './playlist-selector.service.js';
import { PlaylistStateService } from './playlist-state.service.js';

@Module({
  imports: [LogsModule],
  providers: [
    ChannelAvailabilityService,
    ChannelTimeService,
    PlaylistLoaderService,
    PlaylistNormalizerService,
    PlaylistSelectorService,
    PlaylistStateService,
  ],
  exports: [
    ChannelAvailabilityService,
    PlaylistNormalizerService,
    PlaylistLoaderService,
    PlaylistSelectorService,
    PlaylistStateService,
  ],
})
export class PlaylistsModule {}
