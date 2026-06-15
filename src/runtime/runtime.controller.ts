import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
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
  async channels(
    @Query('search') search?: string,
    @Query('enabled') enabled?: string,
    @Query('filter') filter?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const urls = await this.playlistLoader.getPlaylistUrls();
    const allItems = urls.flatMap((playlistUrl) => {
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
    const query = search?.trim().toLowerCase() || '';
    const filtered = allItems.filter((item) => {
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.playlistUrl.toLowerCase().includes(query);
      const matchesEnabled =
        enabled !== 'true' && enabled !== 'false' ? true : item.availableNow === (enabled === 'true');
      const matchesFilter =
        filter === 'errors'
          ? Boolean(item.lastErrorAt || item.consecutiveFailures)
          : filter === 'available'
            ? item.availableNow
            : true;

      return matchesSearch && matchesEnabled && matchesFilter;
    });
    const parsedLimit = this.parseLimit(limit);
    const parsedOffset = this.parseOffset(offset);

    return {
      source: 'json',
      items: filtered.slice(parsedOffset, parsedOffset + parsedLimit),
      total: filtered.length,
      limit: parsedLimit,
      offset: parsedOffset,
    };
  }

  private parseLimit(value?: string): number {
    const limit = Number(value);
    return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50;
  }

  private parseOffset(value?: string): number {
    const offset = Number(value);
    return Number.isFinite(offset) && offset > 0 ? offset : 0;
  }
}
