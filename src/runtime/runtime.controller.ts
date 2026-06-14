import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { ChannelAvailabilityService } from '../channels/channel-availability.service.js';
import { PlaylistLoaderService } from '../playlists/playlist-loader.service.js';
import { PlaylistStateService } from '../playlists/playlist-state.service.js';
import { WorkerStateService } from '../worker/worker-state.service.js';

@Controller('runtime')
@UseGuards(SessionAuthGuard)
export class RuntimeController {
  constructor(
    @Inject(PlaylistLoaderService) private readonly playlistLoader: PlaylistLoaderService,
    @Inject(PlaylistStateService) private readonly playlistState: PlaylistStateService,
    @Inject(ChannelAvailabilityService)
    private readonly channelAvailability: ChannelAvailabilityService,
    @Inject(WorkerStateService) private readonly workerState: WorkerStateService,
  ) {}

  @Get('playlists')
  async playlists() {
    const urls = await this.playlistLoader.getPlaylistUrls();
    const items = urls.map((url) => {
      const state = this.playlistState.getPlaylistState(url);
      const availableChannelsCount = state.channels.filter((channel) =>
        this.channelAvailability.isAvailableNow(channel),
      ).length;

      return {
        url,
        loaded: state.channels.length > 0,
        loading: state.loading,
        channelsCount: state.channels.length,
        availableChannelsCount,
        queueLeft: state.channelQueue.length,
        lastLoadedAt: state.lastLoadedAt ?? null,
        lastLoadError: state.lastLoadError ?? null,
      };
    });

    return {
      source: 'json',
      items,
    };
  }

  @Get('channels')
  async channels() {
    const urls = await this.playlistLoader.getPlaylistUrls();
    const items = urls.flatMap((playlistUrl) => {
      const state = this.playlistState.getPlaylistState(playlistUrl);

      return state.channels.map((channel) => {
        const runtime = this.workerState.getChannelStatus(playlistUrl, channel.url);

        return {
          playlistUrl,
          title: channel.title,
          description: channel.description,
          url: channel.url,
          availableNow: this.channelAvailability.isAvailableNow(channel),
          scale: channel.scale,
          delay: channel.delay,
          userAgent: channel['user-agent'],
          timezones: channel.timezones,
          available: channel.available,
          lastAttemptAt: runtime.lastAttemptAt,
          lastSuccessAt: runtime.lastSuccessAt,
          lastErrorAt: runtime.lastErrorAt,
          lastErrorMessage: runtime.lastErrorMessage,
          consecutiveFailures: runtime.consecutiveFailures,
        };
      });
    });

    return {
      source: 'json',
      items,
    };
  }
}
