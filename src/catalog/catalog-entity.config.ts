import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CatalogEntity } from './catalog.types.js';

export type PrismaDelegate = {
  findMany(args?: Record<string, unknown>): Promise<unknown[]>;
  findUnique(args: Record<string, unknown>): Promise<unknown | null>;
  count(args?: Record<string, unknown>): Promise<number>;
  create(args: Record<string, unknown>): Promise<unknown>;
  update(args: Record<string, unknown>): Promise<unknown>;
  delete(args: Record<string, unknown>): Promise<unknown>;
};

export interface EntityConfig {
  delegate: PrismaDelegate;
  searchableFields: string[];
  include?: Record<string, unknown>;
}

export function getCatalogEntityConfig(prisma: PrismaService, entity: CatalogEntity): EntityConfig {
  const configs: Record<CatalogEntity, EntityConfig> = {
    providers: {
      delegate: prisma.provider,
      searchableFields: ['title', 'urlTemplate'],
      include: { _count: { select: { streams: true } } },
    },
    streams: {
      delegate: prisma.stream,
      searchableFields: ['title', 'streamKey', 'directUrl'],
      include: { provider: true, _count: { select: { channelStreams: true } } },
    },
    channels: {
      delegate: prisma.channel,
      searchableFields: ['title', 'description'],
      include: {
        _count: { select: { playlistChannels: true, channelStreams: true, channelTimezones: true } },
      },
    },
    playlists: {
      delegate: prisma.playlist,
      searchableFields: ['title'],
      include: { _count: { select: { playlistChannels: true, playlistTimezones: true } } },
    },
    timezones: {
      delegate: prisma.timezonePreset,
      searchableFields: ['timezone', 'label'],
      include: { _count: { select: { channelTimezones: true, playlistTimezones: true } } },
    },
    'telegram-chats': {
      delegate: prisma.telegramChat,
      searchableFields: ['title', 'chatId'],
    },
    'caption-templates': {
      delegate: prisma.captionTemplate,
      searchableFields: ['title', 'template'],
    },
  };

  const config = configs[entity];
  if (!config) throw new BadRequestException('Unknown catalog entity');
  return config;
}
