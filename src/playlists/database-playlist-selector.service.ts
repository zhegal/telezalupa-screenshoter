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
    const playlists = await this.prisma.playlist.findMany({
      where: { enabled: true },
      include: {
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
              },
            },
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    return playlists.map((playlist) => {
      const snapshot = this.snapshots.get(playlist.id);
      const channels = playlist.playlistChannels.map((relation) =>
        this.buildRuntimeChannel(
          relation.channel,
          this.playlistConfig.defaultTimezones,
          [],
        ),
      ).length;
      const availableChannelsCount = playlist.playlistChannels.filter((relation) =>
        this.channelAvailability.isAvailableNow(
          this.buildRuntimeChannel(relation.channel, this.playlistConfig.defaultTimezones, []),
        ),
      ).length;

      return {
        id: playlist.id,
        title: playlist.title,
        url: `database:${playlist.id}:${playlist.title}`,
        loaded: true,
        loading: false,
        channelsCount: channels,
        availableChannelsCount,
        queueLeft: snapshot?.channelQueue.length ?? 0,
        lastLoadedAt: null,
        lastLoadError: null,
      };
    });
  }

  async listRuntimeChannels() {
    const playlists = await this.prisma.playlist.findMany({
      where: { enabled: true },
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
                      OR: [{ directUrl: { not: null } }, { streamKey: { not: null }, provider: { enabled: true } }],
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

    return playlists.flatMap((playlist) => {
      const playlistTimezones = this.normalizeTimezoneRelations(playlist.playlistTimezones);

      return playlist.playlistChannels.map((relation) => {
        const channel = this.buildRuntimeChannel(
          relation.channel,
          playlistTimezones,
          relation.channel.channelStreams.map((item) => item.stream),
        );

        return {
          playlistId: playlist.id,
          playlistTitle: playlist.title,
          channelId: relation.channel.id,
          playlistUrl: `database:${playlist.id}:${playlist.title}`,
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
        };
      });
    });
  }

  async getPlaylistChannel(playlistId: string, channelId: string): Promise<SelectedChannel | null> {
    const playlist = await this.prisma.playlist.findFirst({
      where: { id: playlistId },
      include: {
        playlistTimezones: {
          include: { timezonePreset: true },
          orderBy: { priority: 'asc' },
        },
        playlistChannels: {
          where: {
            channelId,
          },
          include: {
            channel: {
              include: {
                channelTimezones: {
                  include: { timezonePreset: true },
                  orderBy: { priority: 'asc' },
                },
                channelStreams: {
                  include: { stream: { include: { provider: true } } },
                  orderBy: [{ priority: 'desc' }, { stream: { priority: 'desc' } }],
                },
              },
            },
          },
        },
      },
    });
    const relation = playlist?.playlistChannels[0];

    if (!playlist || !relation) {
      return null;
    }

    const channel = this.buildChannel(
      relation.channel,
      this.normalizeTimezoneRelations(playlist.playlistTimezones, true),
      true,
    );

    if (!channel) {
      return null;
    }

    return {
      playlistUrl: `database:${playlist.id}:${playlist.title}`,
      channel,
      currentLeft: 0,
      total: 1,
    };
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
                    OR: [{ directUrl: { not: null } }, { streamKey: { not: null }, provider: { enabled: true } }],
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
                      OR: [{ directUrl: { not: null } }, { streamKey: { not: null }, provider: { enabled: true } }],
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
        channelQueue: this.refreshQueuedChannels(this.snapshots.get(playlist.id)?.channelQueue ?? [], channels),
      });
    }

    this.snapshots.clear();

    for (const [id, snapshot] of nextSnapshots) {
      this.snapshots.set(id, snapshot);
    }
  }

  async getDiagnostics() {
    const [
      playlists,
      enabledPlaylists,
      channels,
      enabledChannels,
      streams,
      enabledStreams,
      enabledPlaylistLinks,
      enabledChannelStreamLinks,
      runnablePlaylists,
    ] = await Promise.all([
      this.prisma.playlist.count(),
      this.prisma.playlist.count({ where: { enabled: true } }),
      this.prisma.channel.count(),
      this.prisma.channel.count({ where: { enabled: true } }),
      this.prisma.stream.count(),
      this.prisma.stream.count({ where: { enabled: true } }),
      this.prisma.playlistChannel.count({
        where: {
          enabled: true,
          playlist: { enabled: true },
          channel: { enabled: true },
        },
      }),
      this.prisma.channelStream.count({
        where: {
          enabled: true,
          channel: { enabled: true },
          stream: {
            enabled: true,
            OR: [{ directUrl: { not: null } }, { streamKey: { not: null }, provider: { enabled: true } }],
          },
        },
      }),
      this.prisma.playlist.count({
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
                      OR: [{ directUrl: { not: null } }, { streamKey: { not: null }, provider: { enabled: true } }],
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    const loadedPlaylists = this.snapshots.size;
    const loadedChannels = Array.from(this.snapshots.values()).reduce((total, snapshot) => total + snapshot.channels.length, 0);
    const availableChannels = Array.from(this.snapshots.values()).reduce(
      (total, snapshot) =>
        total + snapshot.channels.filter((channel) => this.channelAvailability.isAvailableNow(channel)).length,
      0,
    );

    return {
      playlists,
      enabledPlaylists,
      channels,
      enabledChannels,
      streams,
      enabledStreams,
      enabledPlaylistLinks,
      enabledChannelStreamLinks,
      runnablePlaylists,
      loadedPlaylists,
      loadedChannels,
      availableChannels,
    };
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
    includeDisabledTimezones = false,
  ): Channel | null {
    const streamCandidates = channel.channelStreams
      .map((relation) => this.buildStreamCandidate(relation.stream))
      .filter((stream): stream is ChannelStreamCandidate => Boolean(stream));

    if (streamCandidates.length === 0) {
      return null;
    }

    const channelTimezones = this.normalizeTimezoneRelations(channel.channelTimezones, includeDisabledTimezones);
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

  private buildRuntimeChannel(
    channel: {
      title: string;
      description: string | null;
      defaultDelaySeconds: number | null;
      defaultScale: string | null;
      channelTimezones: Array<{ timezonePreset: { enabled: boolean; timezone: string; label: string }; priority: number }>;
    },
    playlistTimezones: ChannelTimezone[],
    streams: Array<{
      id: string;
      title: string;
      streamKey: string | null;
      directUrl: string | null;
      userAgent: string | null;
      provider: { enabled: boolean; urlTemplate: string } | null;
    }>,
  ): Channel {
    const streamCandidates = streams
      .map((stream) => this.buildStreamCandidate(stream))
      .filter((stream): stream is ChannelStreamCandidate => Boolean(stream));
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
      url: firstStream?.url || '',
      scale: channel.defaultScale || this.playlistConfig.defaultScale,
      delay: channel.defaultDelaySeconds,
      timezones,
      available: null,
      'user-agent': firstStream?.userAgent || '',
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
    includeDisabled = false,
  ): ChannelTimezone[] {
    return relations
      .filter((relation) => includeDisabled || relation.timezonePreset.enabled)
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

  private refreshQueuedChannels(queuedChannels: Channel[], freshChannels: Channel[]): Channel[] {
    const freshByKey = new Map(freshChannels.map((channel) => [this.channelQueueKey(channel), channel]));

    return queuedChannels
      .map((channel) => freshByKey.get(this.channelQueueKey(channel)))
      .filter((channel): channel is Channel => Boolean(channel) && this.channelAvailability.isAvailableNow(channel));
  }

  private channelQueueKey(channel: Channel): string {
    return `${channel.title}\n${channel.url}`;
  }
}
