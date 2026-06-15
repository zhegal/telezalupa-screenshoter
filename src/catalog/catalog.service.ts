import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import prismaClient from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  BulkOperationStats,
  BulkRelationBody,
  BulkStreamsBody,
  CatalogEntity,
  CatalogListQuery,
  CatalogRelationBody,
  StreamTransformPreviewItem,
} from './catalog.types.js';

const { Prisma } = prismaClient;

type PrismaDelegate = {
  findMany(args?: Record<string, unknown>): Promise<unknown[]>;
  findUnique(args: Record<string, unknown>): Promise<unknown | null>;
  count(args?: Record<string, unknown>): Promise<number>;
  create(args: Record<string, unknown>): Promise<unknown>;
  update(args: Record<string, unknown>): Promise<unknown>;
  delete(args: Record<string, unknown>): Promise<unknown>;
};

interface EntityConfig {
  delegate: PrismaDelegate;
  searchableFields: string[];
  include?: Record<string, unknown>;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(entity: CatalogEntity, query: CatalogListQuery) {
    const config = this.getConfig(entity);
    const where = this.buildWhere(config.searchableFields, query);
    const limit = this.parseLimit(query.limit);
    const offset = this.parseOffset(query.offset);
    const [items, total] = await Promise.all([
      config.delegate.findMany({
        where,
        include: config.include,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }].filter((item) =>
          this.hasPriority(entity) ? true : !('priority' in item),
        ),
        take: limit,
        skip: offset,
      }),
      config.delegate.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  async get(entity: CatalogEntity, id: string) {
    const config = this.getConfig(entity);
    const item = await config.delegate.findUnique({
      where: { id },
      include: config.include,
    });

    if (!item) {
      throw new NotFoundException('Catalog item not found');
    }

    return item;
  }

  async create(entity: CatalogEntity, body: Record<string, unknown>) {
    const config = this.getConfig(entity);
    const data = this.normalizeEntityData(entity, body);

    return config.delegate.create({ data, include: config.include });
  }

  async update(entity: CatalogEntity, id: string, body: Record<string, unknown>) {
    const config = this.getConfig(entity);
    const data = this.normalizeEntityData(entity, body, true);

    try {
      return await config.delegate.update({
        where: { id },
        data,
        include: config.include,
      });
    } catch (err) {
      this.throwPrismaError(err);
    }
  }

  async delete(entity: CatalogEntity, id: string) {
    const config = this.getConfig(entity);

    try {
      await config.delegate.delete({ where: { id } });
      return { ok: true };
    } catch (err) {
      this.throwPrismaError(err);
    }
  }

  async listPlaylistChannels(playlistId: string) {
    await this.ensureExists(this.prisma.playlist, playlistId, 'Playlist not found');

    return {
      items: await this.prisma.playlistChannel.findMany({
        where: { playlistId },
        include: { channel: true },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      }),
    };
  }

  async addPlaylistChannel(playlistId: string, body: CatalogRelationBody) {
    await this.ensureExists(this.prisma.playlist, playlistId, 'Playlist not found');
    const channelId = this.requiredString(body.channelId, 'channelId');
    await this.ensureExists(this.prisma.channel, channelId, 'Channel not found');

    return this.prisma.playlistChannel.create({
      data: {
        playlistId,
        channelId,
        enabled: this.booleanOrDefault(body.enabled, true),
        priority: this.numberOrDefault(body.priority, 0),
      },
      include: { channel: true },
    });
  }

  async updatePlaylistChannel(_playlistId: string, relationId: string, body: CatalogRelationBody) {
    return this.prisma.playlistChannel.update({
      where: { id: relationId },
      data: this.normalizeRelationData(body),
      include: { channel: true },
    });
  }

  async deletePlaylistChannel(_playlistId: string, relationId: string) {
    await this.prisma.playlistChannel.delete({ where: { id: relationId } });
    return { ok: true };
  }

  async bulkAttachPlaylistChannels(playlistId: string, body: BulkRelationBody): Promise<BulkOperationStats> {
    await this.ensureExists(this.prisma.playlist, playlistId, 'Playlist not found');
    const channelIds = this.uniqueIds(body.channelIds);
    const existing = await this.prisma.playlistChannel.findMany({
      where: { playlistId, channelId: { in: channelIds } },
      select: { channelId: true },
    });
    const existingIds = new Set(existing.map((item) => item.channelId));
    const channels = await this.prisma.channel.findMany({
      where: { id: { in: channelIds } },
      select: { id: true },
    });
    const validIds = new Set(channels.map((item) => item.id));
    const createIds = channelIds.filter((id) => validIds.has(id) && !existingIds.has(id));

    if (createIds.length > 0) {
      await this.prisma.playlistChannel.createMany({
        data: createIds.map((channelId) => ({ playlistId, channelId })),
      });
    }

    return {
      requested: channelIds.length,
      created: createIds.length,
      skipped: channelIds.filter((id) => existingIds.has(id)).length,
      failed: channelIds.filter((id) => !validIds.has(id)).length,
    };
  }

  async bulkDetachPlaylistChannels(playlistId: string, body: BulkRelationBody): Promise<BulkOperationStats> {
    await this.ensureExists(this.prisma.playlist, playlistId, 'Playlist not found');
    const channelIds = this.uniqueIds(body.channelIds);
    const deleted = await this.prisma.playlistChannel.deleteMany({
      where: { playlistId, channelId: { in: channelIds } },
    });

    return {
      requested: channelIds.length,
      deleted: deleted.count,
      skipped: channelIds.length - deleted.count,
      failed: 0,
    };
  }

  async listChannelStreams(channelId: string) {
    await this.ensureExists(this.prisma.channel, channelId, 'Channel not found');

    return {
      items: await this.prisma.channelStream.findMany({
        where: { channelId },
        include: { stream: { include: { provider: true } } },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      }),
    };
  }

  async addChannelStream(channelId: string, body: CatalogRelationBody) {
    await this.ensureExists(this.prisma.channel, channelId, 'Channel not found');
    const streamId = this.requiredString(body.streamId, 'streamId');
    await this.ensureExists(this.prisma.stream, streamId, 'Stream not found');

    return this.prisma.channelStream.create({
      data: {
        channelId,
        streamId,
        enabled: this.booleanOrDefault(body.enabled, true),
        priority: this.numberOrDefault(body.priority, 0),
      },
      include: { stream: { include: { provider: true } } },
    });
  }

  async updateChannelStream(_channelId: string, relationId: string, body: CatalogRelationBody) {
    return this.prisma.channelStream.update({
      where: { id: relationId },
      data: this.normalizeRelationData(body),
      include: { stream: { include: { provider: true } } },
    });
  }

  async deleteChannelStream(_channelId: string, relationId: string) {
    await this.prisma.channelStream.delete({ where: { id: relationId } });
    return { ok: true };
  }

  async bulkAttachChannelStreams(channelId: string, body: BulkRelationBody): Promise<BulkOperationStats> {
    await this.ensureExists(this.prisma.channel, channelId, 'Channel not found');
    const streamIds = this.uniqueIds(body.streamIds);
    const existing = await this.prisma.channelStream.findMany({
      where: { channelId, streamId: { in: streamIds } },
      select: { streamId: true },
    });
    const existingIds = new Set(existing.map((item) => item.streamId));
    const streams = await this.prisma.stream.findMany({
      where: { id: { in: streamIds } },
      select: { id: true },
    });
    const validIds = new Set(streams.map((item) => item.id));
    const createIds = streamIds.filter((id) => validIds.has(id) && !existingIds.has(id));

    if (createIds.length > 0) {
      await this.prisma.channelStream.createMany({
        data: createIds.map((streamId) => ({ channelId, streamId })),
      });
    }

    return {
      requested: streamIds.length,
      created: createIds.length,
      skipped: streamIds.filter((id) => existingIds.has(id)).length,
      failed: streamIds.filter((id) => !validIds.has(id)).length,
    };
  }

  async bulkDetachChannelStreams(channelId: string, body: BulkRelationBody): Promise<BulkOperationStats> {
    await this.ensureExists(this.prisma.channel, channelId, 'Channel not found');
    const streamIds = this.uniqueIds(body.streamIds);
    const deleted = await this.prisma.channelStream.deleteMany({
      where: { channelId, streamId: { in: streamIds } },
    });

    return {
      requested: streamIds.length,
      deleted: deleted.count,
      skipped: streamIds.length - deleted.count,
      failed: 0,
    };
  }

  async bulkTransformPreview(body: BulkStreamsBody): Promise<StreamTransformPreviewItem[]> {
    const streamIds = this.uniqueIds(body.streamIds);
    const providerId = this.requiredString(body.providerId, 'providerId');
    await this.ensureExists(this.prisma.provider, providerId, 'Provider not found');
    const streams = await this.prisma.stream.findMany({
      where: { id: { in: streamIds } },
      select: { id: true, directUrl: true },
    });
    const streamMap = new Map(streams.map((stream) => [stream.id, stream]));

    return streamIds.map((streamId) => {
      const stream = streamMap.get(streamId);

      if (!stream) {
        return { streamId, directUrl: null, streamKey: null, providerId, valid: false, error: 'Stream not found' };
      }

      return this.createTransformPreviewItem(stream.id, stream.directUrl, providerId, body);
    });
  }

  async bulkTransformApply(body: BulkStreamsBody): Promise<BulkOperationStats> {
    const preview = await this.bulkTransformPreview(body);
    const validItems = preview.filter((item) => item.valid && item.streamKey);

    await Promise.all(
      validItems.map((item) =>
        this.prisma.stream.update({
          where: { id: item.streamId },
          data: {
            directUrl: null,
            providerId: item.providerId,
            streamKey: item.streamKey,
          },
        }),
      ),
    );

    return {
      requested: preview.length,
      updated: validItems.length,
      skipped: preview.length - validItems.length,
      failed: 0,
    };
  }

  async bulkProviderAssign(body: BulkStreamsBody): Promise<BulkOperationStats> {
    const streamIds = this.uniqueIds(body.streamIds);
    const providerId = this.requiredString(body.providerId, 'providerId');
    await this.ensureExists(this.prisma.provider, providerId, 'Provider not found');
    const updated = await this.prisma.stream.updateMany({
      where: { id: { in: streamIds } },
      data: { providerId },
    });

    return {
      requested: streamIds.length,
      updated: updated.count,
      skipped: streamIds.length - updated.count,
      failed: 0,
    };
  }

  async bulkSetStreamsEnabled(body: BulkStreamsBody, enabled: boolean): Promise<BulkOperationStats> {
    const streamIds = this.uniqueIds(body.streamIds);
    const updated = await this.prisma.stream.updateMany({
      where: { id: { in: streamIds } },
      data: { enabled },
    });

    return {
      requested: streamIds.length,
      updated: updated.count,
      skipped: streamIds.length - updated.count,
      failed: 0,
    };
  }

  async listChannelTimezones(channelId: string) {
    await this.ensureExists(this.prisma.channel, channelId, 'Channel not found');

    return {
      items: await this.prisma.channelTimezone.findMany({
        where: { channelId },
        include: { timezonePreset: true },
        orderBy: [{ priority: 'asc' }],
      }),
    };
  }

  async addChannelTimezone(channelId: string, body: CatalogRelationBody) {
    await this.ensureExists(this.prisma.channel, channelId, 'Channel not found');
    const timezonePresetId = this.requiredString(body.timezonePresetId, 'timezonePresetId');
    await this.ensureExists(this.prisma.timezonePreset, timezonePresetId, 'Timezone preset not found');

    return this.prisma.channelTimezone.create({
      data: {
        channelId,
        timezonePresetId,
        priority: this.numberOrDefault(body.priority, 0),
      },
      include: { timezonePreset: true },
    });
  }

  async updateChannelTimezone(_channelId: string, relationId: string, body: CatalogRelationBody) {
    return this.prisma.channelTimezone.update({
      where: { id: relationId },
      data: { priority: this.numberOrDefault(body.priority, 0) },
      include: { timezonePreset: true },
    });
  }

  async deleteChannelTimezone(_channelId: string, relationId: string) {
    await this.prisma.channelTimezone.delete({ where: { id: relationId } });
    return { ok: true };
  }

  async listPlaylistTimezones(playlistId: string) {
    await this.ensureExists(this.prisma.playlist, playlistId, 'Playlist not found');

    return {
      items: await this.prisma.playlistTimezone.findMany({
        where: { playlistId },
        include: { timezonePreset: true },
        orderBy: [{ priority: 'asc' }],
      }),
    };
  }

  async addPlaylistTimezone(playlistId: string, body: CatalogRelationBody) {
    await this.ensureExists(this.prisma.playlist, playlistId, 'Playlist not found');
    const timezonePresetId = this.requiredString(body.timezonePresetId, 'timezonePresetId');
    await this.ensureExists(this.prisma.timezonePreset, timezonePresetId, 'Timezone preset not found');

    return this.prisma.playlistTimezone.create({
      data: {
        playlistId,
        timezonePresetId,
        priority: this.numberOrDefault(body.priority, 0),
      },
      include: { timezonePreset: true },
    });
  }

  async updatePlaylistTimezone(_playlistId: string, relationId: string, body: CatalogRelationBody) {
    return this.prisma.playlistTimezone.update({
      where: { id: relationId },
      data: { priority: this.numberOrDefault(body.priority, 0) },
      include: { timezonePreset: true },
    });
  }

  async deletePlaylistTimezone(_playlistId: string, relationId: string) {
    await this.prisma.playlistTimezone.delete({ where: { id: relationId } });
    return { ok: true };
  }

  private getConfig(entity: CatalogEntity): EntityConfig {
    const configs: Record<CatalogEntity, EntityConfig> = {
      providers: {
        delegate: this.prisma.provider,
        searchableFields: ['title', 'urlTemplate', 'matchPrefix', 'matchSuffix'],
        include: { _count: { select: { streams: true } } },
      },
      streams: {
        delegate: this.prisma.stream,
        searchableFields: ['title', 'streamKey', 'directUrl'],
        include: { provider: true, _count: { select: { channelStreams: true } } },
      },
      channels: {
        delegate: this.prisma.channel,
        searchableFields: ['title', 'description'],
        include: {
          _count: {
            select: {
              playlistChannels: true,
              channelStreams: true,
              channelTimezones: true,
            },
          },
        },
      },
      playlists: {
        delegate: this.prisma.playlist,
        searchableFields: ['title'],
        include: {
          _count: {
            select: {
              playlistChannels: true,
              playlistTimezones: true,
            },
          },
        },
      },
      timezones: {
        delegate: this.prisma.timezonePreset,
        searchableFields: ['timezone', 'label'],
        include: {
          _count: {
            select: {
              channelTimezones: true,
              playlistTimezones: true,
            },
          },
        },
      },
      'telegram-chats': {
        delegate: this.prisma.telegramChat,
        searchableFields: ['title', 'chatId'],
      },
      'caption-templates': {
        delegate: this.prisma.captionTemplate,
        searchableFields: ['title', 'template'],
      },
    };

    const config = configs[entity];

    if (!config) {
      throw new BadRequestException('Unknown catalog entity');
    }

    return config;
  }

  private normalizeEntityData(
    entity: CatalogEntity,
    body: Record<string, unknown>,
    partial = false,
  ): Record<string, unknown> {
    if (entity === 'providers') {
      const data = this.pick(body, ['title', 'urlTemplate', 'matchPrefix', 'matchSuffix', 'enabled'], partial);
      const template = data.urlTemplate;

      if (typeof template === 'string' && !template.includes('{streamKey}')) {
        throw new BadRequestException('Provider urlTemplate must contain {streamKey}');
      }

      data.matchPrefix = this.normalizeOptionalString(data.matchPrefix);
      data.matchSuffix = this.normalizeOptionalString(data.matchSuffix);

      return data;
    }

    if (entity === 'streams') {
      const data = this.pick(
        body,
        ['title', 'providerId', 'streamKey', 'directUrl', 'userAgent', 'enabled', 'priority'],
        partial,
      );
      const providerId = this.normalizeOptionalString(data.providerId);
      const streamKey = this.normalizeOptionalString(data.streamKey);
      const directUrl = this.normalizeOptionalString(data.directUrl);

      data.providerId = providerId;
      data.streamKey = streamKey;
      data.directUrl = directUrl;
      data.userAgent = this.normalizeOptionalString(data.userAgent);

      if (!partial || 'providerId' in data || 'streamKey' in data || 'directUrl' in data) {
        if (providerId && !streamKey) {
          throw new BadRequestException('streamKey is required when providerId is set');
        }

        if (!providerId && !directUrl) {
          throw new BadRequestException('directUrl is required when providerId is not set');
        }
      }

      return data;
    }

    if (entity === 'channels') {
      const data = this.pick(
        body,
        ['title', 'description', 'enabled', 'defaultDelaySeconds', 'defaultScale'],
        partial,
      );
      data.description = this.normalizeOptionalString(data.description);
      data.defaultScale = this.normalizeOptionalString(data.defaultScale);
      return data;
    }

    if (entity === 'playlists') {
      return this.pick(body, ['title', 'enabled', 'priority'], partial);
    }

    if (entity === 'timezones') {
      return this.pick(body, ['timezone', 'label', 'enabled', 'priority'], partial);
    }

    if (entity === 'telegram-chats') {
      return this.pick(body, ['title', 'chatId', 'enabled', 'isDefault'], partial);
    }

    return this.pick(body, ['title', 'template', 'enabled', 'isDefault'], partial);
  }

  private pick(
    body: Record<string, unknown>,
    fields: string[],
    partial: boolean,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    for (const field of fields) {
      if (field in body) {
        data[field] = this.normalizeValue(field, body[field]);
      } else if (!partial && this.isRequiredField(field)) {
        throw new BadRequestException(`${field} is required`);
      }
    }

    return data;
  }

  private normalizeValue(field: string, value: unknown): unknown {
    if (['enabled', 'isDefault'].includes(field)) {
      return typeof value === 'boolean' ? value : value === 'true';
    }

    if (['priority', 'defaultDelaySeconds'].includes(field)) {
      return this.numberOrNull(value);
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    return value;
  }

  private isRequiredField(field: string): boolean {
    return ['title', 'urlTemplate', 'timezone', 'label', 'chatId', 'template'].includes(field);
  }

  private buildWhere(fields: string[], query: CatalogListQuery): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (query.enabled === 'true' || query.enabled === 'false') {
      where.enabled = query.enabled === 'true';
    }

    if (query.search?.trim()) {
      where.OR = fields.map((field) => ({
        [field]: { contains: query.search?.trim(), mode: 'insensitive' },
      }));
    }

    return where;
  }

  private parseLimit(value?: string): number {
    const limit = Number(value);
    return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50;
  }

  private parseOffset(value?: string): number {
    const offset = Number(value);
    return Number.isFinite(offset) && offset > 0 ? offset : 0;
  }

  private hasPriority(entity: CatalogEntity): boolean {
    return ['streams', 'playlists', 'timezones'].includes(entity);
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required`);
    }

    return value.trim();
  }

  private normalizeOptionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private numberOrDefault(value: unknown, fallback: number): number {
    const normalized = this.numberOrNull(value);
    return normalized === null ? fallback : normalized;
  }

  private numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private booleanOrDefault(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  private normalizeRelationData(body: CatalogRelationBody): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if ('enabled' in body) {
      data.enabled = this.booleanOrDefault(body.enabled, true);
    }

    if ('priority' in body) {
      data.priority = this.numberOrDefault(body.priority, 0);
    }

    return data;
  }

  private uniqueIds(ids: unknown): string[] {
    if (!Array.isArray(ids)) {
      throw new BadRequestException('ids array is required');
    }

    return Array.from(
      new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)),
    );
  }

  private createTransformPreviewItem(
    streamId: string,
    directUrl: string | null,
    providerId: string,
    body: BulkStreamsBody,
  ): StreamTransformPreviewItem {
    if (!directUrl) {
      return { streamId, directUrl, streamKey: null, providerId, valid: false, error: 'directUrl is empty' };
    }

    const prefix = typeof body.prefixToStrip === 'string' ? body.prefixToStrip : '';
    const suffix = typeof body.suffixToStrip === 'string' ? body.suffixToStrip : '';

    if (prefix && !directUrl.startsWith(prefix)) {
      return { streamId, directUrl, streamKey: null, providerId, valid: false, error: 'prefix does not match' };
    }

    if (suffix && !directUrl.endsWith(suffix)) {
      return { streamId, directUrl, streamKey: null, providerId, valid: false, error: 'suffix does not match' };
    }

    const start = prefix.length;
    const end = suffix ? directUrl.length - suffix.length : directUrl.length;
    const streamKey = directUrl.slice(start, end);

    if (!streamKey) {
      return { streamId, directUrl, streamKey: null, providerId, valid: false, error: 'streamKey is empty' };
    }

    return { streamId, directUrl, streamKey, providerId, valid: true };
  }

  private async ensureExists(delegate: PrismaDelegate, id: string, message: string): Promise<void> {
    const item = await delegate.findUnique({ where: { id } });

    if (!item) {
      throw new NotFoundException(message);
    }
  }

  private throwPrismaError(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        throw new NotFoundException('Catalog item not found');
      }

      if (err.code === 'P2003') {
        throw new ConflictException('Catalog item has linked records');
      }
    }

    throw err;
  }
}
