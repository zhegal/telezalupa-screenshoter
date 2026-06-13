import { Inject, Injectable } from '@nestjs/common';
import { PLAYLIST_CONFIG, type PlaylistConfig } from '../config/playlist.config.js';
import type { Channel, ChannelTimezone } from './channel.types.js';

@Injectable()
export class ChannelTimeService {
  constructor(@Inject(PLAYLIST_CONFIG) private readonly playlistConfig: PlaylistConfig) {}

  normalizeTimezones(channel: Channel): ChannelTimezone[] {
    if (!Array.isArray(channel.timezones)) {
      return this.playlistConfig.defaultTimezones;
    }

    const zones = channel.timezones
      .filter(
        (item): item is ChannelTimezone =>
          Array.isArray(item) && typeof item[0] === 'string' && typeof item[1] === 'string',
      )
      .map<ChannelTimezone>((item) => [item[0], item[1]]);

    return zones.length > 0 ? zones : this.playlistConfig.defaultTimezones;
  }

  getDelaySeconds(channel: Channel): number {
    return Number.isFinite(channel.delay) ? Number(channel.delay) : this.playlistConfig.defaultDelaySeconds;
  }
}
