import { Injectable } from '@nestjs/common';
import { ChannelAvailabilityService } from '../channels/channel-availability.service.js';
import { shuffleArray } from '../common/utils/shuffle.js';
import { PlaylistLoaderService } from './playlist-loader.service.js';
import { PlaylistStateService } from './playlist-state.service.js';
import type { PlaylistState, SelectedChannel } from './playlist.types.js';

@Injectable()
export class PlaylistSelectorService {
  private playlistQueue: string[] = [];
  private lastPlaylistUrl: string | null = null;

  constructor(
    private readonly playlistLoader: PlaylistLoaderService,
    private readonly playlistState: PlaylistStateService,
    private readonly channelAvailability: ChannelAvailabilityService,
  ) {}

  reset(): void {
    this.playlistQueue = [];
    this.lastPlaylistUrl = null;
    this.playlistState.resetQueues();
  }

  async selectChannel(): Promise<SelectedChannel | null> {
    const playlistUrls = await this.playlistLoader.getPlaylistUrls();

    if (!Array.isArray(playlistUrls) || playlistUrls.length === 0) {
      return null;
    }

    const attempts = playlistUrls.length;

    for (let i = 0; i < attempts; i += 1) {
      const playlistUrl = this.getNextPlaylistUrl(playlistUrls);

      if (!playlistUrl) {
        continue;
      }

      const selected = await this.getNextChannelFromPlaylist(playlistUrl);

      if (!selected) {
        continue;
      }

      this.lastPlaylistUrl = playlistUrl;

      return selected;
    }

    return null;
  }

  private refillPlaylistQueue(playlistUrls: string[]): void {
    this.playlistQueue = shuffleArray(playlistUrls);

    if (this.playlistQueue.length > 1 && this.playlistQueue[0] === this.lastPlaylistUrl) {
      const index = this.playlistQueue.findIndex((url) => url !== this.lastPlaylistUrl);

      if (index > 0) {
        const first = this.playlistQueue[0];
        this.playlistQueue[0] = this.playlistQueue[index];
        this.playlistQueue[index] = first;
      }
    }
  }

  private getNextPlaylistUrl(playlistUrls: string[]): string | null {
    if (this.playlistQueue.length === 0) {
      this.refillPlaylistQueue(playlistUrls);
    }

    return this.playlistQueue.shift() || null;
  }

  private async refillChannelQueue(state: PlaylistState): Promise<void> {
    await this.playlistLoader.loadPlaylist(state.url, true);

    const availableChannels = state.channels.filter((channel) =>
      this.channelAvailability.isAvailableNow(channel),
    );

    state.channelQueue = shuffleArray(availableChannels);
  }

  private async getNextChannelFromPlaylist(playlistUrl: string): Promise<SelectedChannel | null> {
    const loaded = await this.playlistLoader.loadPlaylist(playlistUrl);

    if (!loaded) {
      return null;
    }

    const state = this.playlistState.getPlaylistState(playlistUrl);

    if (state.channelQueue.length === 0) {
      await this.refillChannelQueue(state);
    }

    if (state.channelQueue.length === 0) {
      return null;
    }

    const channel = state.channelQueue.shift();

    if (!channel) {
      return null;
    }

    return {
      playlistUrl,
      channel,
      currentLeft: state.channelQueue.length,
      total: state.channels.length,
    };
  }
}
