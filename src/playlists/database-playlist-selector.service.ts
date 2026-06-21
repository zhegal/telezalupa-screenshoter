import { Inject, Injectable } from '@nestjs/common';
import { ChannelAvailabilityService } from '../channels/channel-availability.service.js';
import type { Channel, ChannelStreamCandidate, ChannelTimezone } from '../channels/channel.types.js';
import { shuffleArray } from '../common/utils/shuffle.js';
import { PLAYLIST_CONFIG, type PlaylistConfig } from '../config/playlist.config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SelectedChannel } from './playlist.types.js';

interface DatabasePlaylistSnapshot {
  id: string;
  title: string;
  channels: Channel[];
  channelQueue: Channel[];
}

@Injectable()
export class DatabasePlaylistSelectorService {
  private playlistQueue: string[] = [];
  private lastPlaylistId: string | null = null;
  private readonly snapshots = new Map<string, DatabasePlaylistSnapshot>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PLAYLIST_CONFIG) private readonly playlistConfig: PlaylistConfig,
    @Inject(ChannelAvailabilityService)
    private readonly channelAvailability: ChannelAvailabilityService,
  ) {}

  reset(): void {
    this.playlistQueue = [];
    this.lastPlaylistId = null;
    this.snapshots.clear();
  }

  async selectChannel(): Promise<SelectedChannel | null> {
    await this.reloadSnapshots();
    const playlistIds = this.getAvailablePlaylistIds();

    if (playlistIds.length === 0) {
      return null;
    }

    for (let i = 0; i < playlistIds.length; i += 1) {
      const playlistId = this.getNextPlaylistId(playlistIds);

      if (!playlistId) {
        continue;
      }

      const snapshot = this.snapshots.get(playlistId);

      if (!snapshot) {
        continue;
      }

      if (snapshot.channelQueue.length === 0) {
        this.refillChannelQueue(snapshot);
      }

      const channel = snapshot.channelQueue.shift();

      if (!channel) {
        continue;
      }

      this.lastPlaylistId = playlistId;

      return {
        playlistUrl: `database:${snapshot.id}:${snapshot.title}`,
        channel,
        currentLeft: snapshot.channelQueue.length,
        total: snapshot.channels.length,
      };
    }

    return null;
  }

  async listRuntimePlaylists() {
    await this.reloadSnapshots();

    return Array.from(this.snapshots.values()).map((snapshot) => {
      const availableChannelsCount = snapshot.channels.filter((channel) =>
        this.channelAvailability.isAvailableNow(channel),
      ).length;

      return {
        url: `database:${snapshot.id}:${snapshot.title}`,
        loaded: true,
        loading: false,
        channelsCount: snapshot.channels.length,
        availableChannelsCount,
        queueLeft: snapshot.channelQueue.length,
        lastLoadedAt: null,
        lastLoadError: null,
      };
    });
  }

  async listRuntimeChannels() {
    await this.reloadSnapshots();

    return Array.from(this.snapshots.values()).flatMap((snapshot) =>
      snapshot.channels.map((channel) => ({
        playlistUrl: `database:${snapshot.id}:${snapshot.title}`,
        title: channel.title,
        description: channel.description,
        url: channel.url,
        availableNow: this.channelAvailability.isAvailableNow(channel),
        scale: channel.scale,
        delay: channel.delay,
        userAgent: channel['user-agent'],
        timezones: channel.timezones,
        available: channel.available,
        streamCandidates: channel.streamCandidates?.length ?? 0,
        streamCandidateUrls: channel.streamCandidates?.map((stream) => stream.url) ?? [channel.url],
      })),
    );
  }

  private async reloadSnapshots(): Promise<void> {
    const playlists = await this.prisma.playlist.findMany({
      where: {
        enabled: true,
        playlistChannels: {
          some: {
            enabled: true,
            channel: {
              enabled: true,
              channelStreams: {
                some: {
                  enabled: true,
                  stream: {
                    enabled: true,
                    OR: [{ providerId: null }, { provider: { enabled: true } }],
                  },
                },
              },
            },
          },
        },
      },
      include: {
        playlistTimezones: {
          include: { timezonePreset: true },
          orderBy: { priority: 'asc' },
        },
        playlistChannels: {
          where: {
            enabled: true,
            channel: { enabled: true },
          },
          include: {
            channel: {
              include: {
                channelTimezones: {
                  include: { timezonePreset: true },
                  orderBy: { priority: 'asc' },
                },
                channelStreams: {
                  where: {
                    enabled: true,
                    stream: {
                      enabled: true,
                      OR: [{ providerId: null }, { provider: { enabled: true } }],
                    },
                  },
                  include: {
                    stream: {
                      include: { provider: true },
                    },
                  },
                  orderBy: [{ priority: 'desc' }, { stream: { priority: 'desc' } }],
                },
              },
            },
          },
          orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    const nextSnapshots = new Map<string, DatabasePlaylistSnapshot>();

    for (const playlist of playlists) {
      const playlistTimezones = this.normalizeTimezoneRelations(playlist.playlistTimezones);
      const channels = playlist.playlistChannels
        .map((relation) => this.buildChannel(relation.channel, playlistTimezones))
        .filter((channel): channel is Channel => Boolean(channel));

      nextSnapshots.set(playlist.id, {
        id: playlist.id,
        title: playlist.title,
        channels,
        channelQueue: this.snapshots.get(playlist.id)?.channelQueue.filter((channel) =>
          channels.some((item) => item.title === channel.title && item.url === channel.url),
        ) ?? [],
      });
    }

    this.snapshots.clear();

    for (const [id, snapshot] of nextSnapshots) {
      this.snapshots.set(id, snapshot);
    }
  }

  private buildChannel(
    channel: {
      title: string;
      description: string | null;
      defaultDelaySeconds: number | null;
      defaultScale: string | null;
      channelTimezones: Array<{ timezonePreset: { enabled: boolean; timezone: string; label: string }; priority: number }>;
      channelStreams: Array<{
        stream: {
          id: string;
          title: string;
          streamKey: string | null;
          directUrl: string | null;
          userAgent: string | null;
          provider: { enabled: boolean; urlTemplate: string } | null;
        };
      }>;
    },
    playlistTimezones: ChannelTimezone[],
  ): Channel | null {
    const streamCandidates = channel.channelStreams
      .map((relation) => this.buildStreamCandidate(relation.stream))
      .filter((stream): stream is ChannelStreamCandidate => Boolean(stream));

    if (streamCandidates.length === 0) {
      return null;
    }

    const channelTimezones = this.normalizeTimezoneRelations(channel.channelTimezones);
    const timezones =
      channelTimezones.length > 0
        ? channelTimezones
        : playlistTimezones.length > 0
          ? playlistTimezones
          : this.playlistConfig.defaultTimezones;
    const firstStream = streamCandidates[0];

    return {
      title: channel.title,
      description: channel.description || '',
      url: firstStream.url,
      scale: channel.defaultScale || this.playlistConfig.defaultScale,
      delay: channel.defaultDelaySeconds,
      timezones,
      available: null,
      'user-agent': firstStream.userAgent,
      streamCandidates,
    };
  }

  private buildStreamCandidate(stream: {
    id: string;
    title: string;
    streamKey: string | null;
    directUrl: string | null;
    userAgent: string | null;
    provider: { enabled: boolean; urlTemplate: string } | null;
  }): ChannelStreamCandidate | null {
    const url = stream.provider
      ? stream.streamKey
        ? stream.provider.urlTemplate.replaceAll('{streamKey}', stream.streamKey)
        : null
      : stream.directUrl;

    if (!url) {
      return null;
    }

    return {
      id: stream.id,
      title: stream.title,
      url,
      userAgent: stream.userAgent || '',
    };
  }

  private normalizeTimezoneRelations(
    relations: Array<{ timezonePreset: { enabled: boolean; timezone: string; label: string }; priority: number }>,
  ): ChannelTimezone[] {
    return relations
      .filter((relation) => relation.timezonePreset.enabled)
      .map((relation) => [relation.timezonePreset.timezone, relation.timezonePreset.label]);
  }

  private getAvailablePlaylistIds(): string[] {
    return Array.from(this.snapshots.values())
      .filter((snapshot) => snapshot.channels.some((channel) => this.channelAvailability.isAvailableNow(channel)))
      .map((snapshot) => snapshot.id);
  }

  private refillPlaylistQueue(playlistIds: string[]): void {
    this.playlistQueue = shuffleArray(playlistIds);

    if (this.playlistQueue.length > 1 && this.playlistQueue[0] === this.lastPlaylistId) {
      const index = this.playlistQueue.findIndex((id) => id !== this.lastPlaylistId);

      if (index > 0) {
        const first = this.playlistQueue[0];
        this.playlistQueue[0] = this.playlistQueue[index];
        this.playlistQueue[index] = first;
      }
    }
  }

  private getNextPlaylistId(playlistIds: string[]): string | null {
    if (this.playlistQueue.length === 0) {
      this.refillPlaylistQueue(playlistIds);
    }

    return this.playlistQueue.shift() || null;
  }

  private refillChannelQueue(snapshot: DatabasePlaylistSnapshot): void {
    const availableChannels = snapshot.channels.filter((channel) =>
      this.channelAvailability.isAvailableNow(channel),
    );

    snapshot.channelQueue = shuffleArray(availableChannels);
  }
}
