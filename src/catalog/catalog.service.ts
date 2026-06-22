import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import prismaClient from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  getCatalogEntityConfig,
  type PrismaDelegate,
} from './catalog-entity.config.js';
import type {
  BulkOperationStats,
  BulkRelationBody,
  BulkStreamsBody,
  CatalogEntity,
  CatalogListQuery,
  CatalogRelationBody,
  StreamTransformPreviewItem,
} from './catalog.types.js';
import {
  booleanOrDefault,
  normalizeOptionalString,
  numberOrDefault,
  numberOrNull,
  parseLimit,
  parseOffset,
  requiredString,
  uniqueIds,
  uniqueOptionalIds,
} from './catalog-value.utils.js';

const { Prisma } = prismaClient;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(entity: CatalogEntity, query: CatalogListQuery) {
    const config = getCatalogEntityConfig(this.prisma, entity);
    const where = this.buildWhere(config.searchableFields, query);
    const limit = parseLimit(query.limit);
    const offset = parseOffset(query.offset);
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
    const config = getCatalogEntityConfig(this.prisma, entity);
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
    const config = getCatalogEntityConfig(this.prisma, entity);
    const data = this.normalizeEntityData(entity, body);

    return config.delegate.create({ data, include: config.include });
  }

  async update(entity: CatalogEntity, id: string, body: Record<string, unknown>) {
    const config = getCatalogEntityConfig(this.prisma, entity);
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
    if (entity === 'playlists') {
      await this.deleteOwnedPlaylist(id);
      return { ok: true };
    }

    if (entity === 'channels') {
      await this.deleteOwnedChannel(id);
      return { ok: true };
    }

    const config = getCatalogEntityConfig(this.prisma, entity);

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
        include: {
          channel: {
            include: {
              _count: { select: { channelStreams: true, channelTimezones: true } },
            },
          },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      }),
    };
  }

  async createPlaylistOwnedChannel(playlistId: string, body: Record<string, unknown>) {
    await this.ensureExists(this.prisma.playlist, playlistId, 'Playlist not found');
    const streamData = this.normalizeOwnedStreamData(body);
    const timezonePresetIds = uniqueOptionalIds(body.timezonePresetIds);

    return this.prisma.$transaction(async (tx) => {
      const channel = await tx.channel.create({
        data: {
          title: requiredString(body.title, 'title'),
          description: normalizeOptionalString(body.description),
          enabled: booleanOrDefault(body.enabled, true),
        },
      });
      const stream = await tx.stream.create({
        data: {
          title: `${channel.title} stream`,
          providerId: streamData.providerId,
          streamKey: streamData.streamKey,
          directUrl: streamData.directUrl,
          userAgent: streamData.userAgent,
          enabled: true,
          priority: 0,
        },
      });

      await tx.playlistChannel.create({ data: { playlistId, channelId: channel.id, enabled: true, priority: 0 } });
      await tx.channelStream.create({ data: { channelId: channel.id, streamId: stream.id, enabled: true, priority: 0 } });

      if (timezonePresetIds.length > 0) {
        await tx.channelTimezone.createMany({
          data: timezonePresetIds.map((timezonePresetId, index) => ({
            channelId: channel.id,
            timezonePresetId,
            priority: index,
          })),
        });
      }

      return tx.playlistChannel.findFirst({
        where: { playlistId, channelId: channel.id },
        include: { channel: { include: { _count: { select: { channelStreams: true, channelTimezones: true } } } } },
      });
    });
  }

  async bulkDeletePlaylistOwnedChannels(playlistId: string, body: BulkRelationBody): Promise<BulkOperationStats> {
    const channelIds = uniqueIds(body.channelIds);

    for (const channelId of channelIds) {
      await this.deletePlaylistOwnedChannel(playlistId, channelId);
    }

    return { requested: channelIds.length, deleted: channelIds.length, skipped: 0, failed: 0 };
  }

  async deletePlaylistOwnedChannel(playlistId: string, channelId: string) {
    await this.ensurePlaylistChannel(playlistId, channelId);
    await this.deleteOwnedChannel(channelId);
    return { ok: true };
  }

  async copyPlaylistOwnedChannel(playlistId: string, channelId: string, body: Record<string, unknown>) {
    await this.ensurePlaylistChannel(playlistId, channelId);
    const targetPlaylistId = requiredString(body.targetPlaylistId || playlistId, 'targetPlaylistId');
    await this.ensureExists(this.prisma.playlist, targetPlaylistId, 'Target playlist not found');
    const source = await this.getChannelForClone(channelId);

    return this.cloneChannelToPlaylist(source, targetPlaylistId);
  }

  async movePlaylistOwnedChannel(playlistId: string, channelId: string, body: Record<string, unknown>) {
    await this.ensurePlaylistChannel(playlistId, channelId);
    const targetPlaylistId = requiredString(body.targetPlaylistId, 'targetPlaylistId');
    await this.ensureExists(this.prisma.playlist, targetPlaylistId, 'Target playlist not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.playlistChannel.deleteMany({ where: { playlistId, channelId } });
      await tx.playlistChannel.deleteMany({ where: { playlistId: targetPlaylistId, channelId } });
      await tx.playlistChannel.create({ data: { playlistId: targetPlaylistId, channelId, enabled: true, priority: 0 } });
    });

    return { ok: true };
  }

  async addPlaylistChannel(playlistId: string, body: CatalogRelationBody) {
    await this.ensureExists(this.prisma.playlist, playlistId, 'Playlist not found');
    const channelId = requiredString(body.channelId, 'channelId');
    await this.ensureExists(this.prisma.channel, channelId, 'Channel not found');

    return this.prisma.playlistChannel.create({
      data: {
        playlistId,
        channelId,
        enabled: booleanOrDefault(body.enabled, true),
        priority: numberOrDefault(body.priority, 0),
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
    const channelIds = uniqueIds(body.channelIds);
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
    const channelIds = uniqueIds(body.channelIds);
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

  async createChannelOwnedStream(channelId: string, body: Record<string, unknown>) {
    await this.ensureExists(this.prisma.channel, channelId, 'Channel not found');
    const streamData = this.normalizeOwnedStreamData(body);

    return this.prisma.$transaction(async (tx) => {
      const stream = await tx.stream.create({
        data: {
          title: normalizeOptionalString(body.title) || 'Stream',
          providerId: streamData.providerId,
          streamKey: streamData.streamKey,
          directUrl: streamData.directUrl,
          userAgent: streamData.userAgent,
          enabled: true,
          priority: numberOrDefault(body.priority, 0),
        },
      });

      return tx.channelStream.create({
        data: { channelId, streamId: stream.id, enabled: true, priority: numberOrDefault(body.priority, 0) },
        include: { stream: { include: { provider: true } } },
      });
    });
  }

  async deleteChannelOwnedStream(channelId: string, streamId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.channelStream.deleteMany({ where: { channelId, streamId } });
      await tx.stream.delete({ where: { id: streamId } });
    });

    return { ok: true };
  }

  async addChannelStream(channelId: string, body: CatalogRelationBody) {
    await this.ensureExists(this.prisma.channel, channelId, 'Channel not found');
    const streamId = requiredString(body.streamId, 'streamId');
    await this.ensureExists(this.prisma.stream, streamId, 'Stream not found');

    return this.prisma.channelStream.create({
      data: {
        channelId,
        streamId,
        enabled: booleanOrDefault(body.enabled, true),
        priority: numberOrDefault(body.priority, 0),
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
    const streamIds = uniqueIds(body.streamIds);
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
    const streamIds = uniqueIds(body.streamIds);
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
    const streamIds = uniqueIds(body.streamIds);
    const providerId = requiredString(body.providerId, 'providerId');
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
    const streamIds = uniqueIds(body.streamIds);
    const providerId = requiredString(body.providerId, 'providerId');
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
    const streamIds = uniqueIds(body.streamIds);
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
    const timezonePresetId = requiredString(body.timezonePresetId, 'timezonePresetId');
    await this.ensureExists(this.prisma.timezonePreset, timezonePresetId, 'Timezone preset not found');

    return this.prisma.channelTimezone.create({
      data: {
        channelId,
        timezonePresetId,
        priority: numberOrDefault(body.priority, 0),
      },
      include: { timezonePreset: true },
    });
  }

  async updateChannelTimezone(_channelId: string, relationId: string, body: CatalogRelationBody) {
    return this.prisma.channelTimezone.update({
      where: { id: relationId },
      data: { priority: numberOrDefault(body.priority, 0) },
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
    const timezonePresetId = requiredString(body.timezonePresetId, 'timezonePresetId');
    await this.ensureExists(this.prisma.timezonePreset, timezonePresetId, 'Timezone preset not found');

    return this.prisma.playlistTimezone.create({
      data: {
        playlistId,
        timezonePresetId,
        priority: numberOrDefault(body.priority, 0),
      },
      include: { timezonePreset: true },
    });
  }

  async updatePlaylistTimezone(_playlistId: string, relationId: string, body: CatalogRelationBody) {
    return this.prisma.playlistTimezone.update({
      where: { id: relationId },
      data: { priority: numberOrDefault(body.priority, 0) },
      include: { timezonePreset: true },
    });
  }

  async deletePlaylistTimezone(_playlistId: string, relationId: string) {
    await this.prisma.playlistTimezone.delete({ where: { id: relationId } });
    return { ok: true };
  }

  private normalizeEntityData(
    entity: CatalogEntity,
    body: Record<string, unknown>,
    partial = false,
  ): Record<string, unknown> {
    if (entity === 'providers') {
      const data = this.pick(body, ['title', 'urlTemplate', 'enabled'], partial);
      const template = data.urlTemplate;

      if (typeof template === 'string' && !template.includes('{streamKey}')) {
        throw new BadRequestException('Provider urlTemplate must contain {streamKey}');
      }

      return data;
    }

    if (entity === 'streams') {
      const data = this.pick(
        body,
        ['title', 'providerId', 'streamKey', 'directUrl', 'userAgent', 'enabled', 'priority'],
        partial,
      );
      const providerId = normalizeOptionalString(data.providerId);
      const streamKey = normalizeOptionalString(data.streamKey);
      const directUrl = normalizeOptionalString(data.directUrl);

      data.providerId = providerId;
      data.streamKey = streamKey;
      data.directUrl = directUrl;
      data.userAgent = normalizeOptionalString(data.userAgent);

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
      data.description = normalizeOptionalString(data.description);
      data.defaultScale = normalizeOptionalString(data.defaultScale);
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
      return numberOrNull(value);
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

  private hasPriority(entity: CatalogEntity): boolean {
    return ['streams', 'playlists', 'timezones'].includes(entity);
  }

  private normalizeOwnedStreamData(body: Record<string, unknown>) {
    const streamType = typeof body.streamType === 'string' ? body.streamType : 'direct';
    const userAgent = normalizeOptionalString(body.userAgent);

    if (streamType === 'provider') {
      const providerId = requiredString(body.providerId, 'providerId');
      const streamKey = requiredString(body.streamKey, 'streamKey');
      return { providerId, streamKey, directUrl: null, userAgent };
    }

    return {
      providerId: null,
      streamKey: null,
      directUrl: requiredString(body.directUrl, 'directUrl'),
      userAgent,
    };
  }

  private async ensurePlaylistChannel(playlistId: string, channelId: string): Promise<void> {
    const relation = await this.prisma.playlistChannel.findFirst({ where: { playlistId, channelId } });

    if (!relation) {
      throw new NotFoundException('Playlist channel not found');
    }
  }

  private async deleteOwnedChannel(channelId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const streams = await tx.channelStream.findMany({ where: { channelId }, select: { streamId: true } });
      const streamIds = streams.map((stream) => stream.streamId);

      await tx.channelTimezone.deleteMany({ where: { channelId } });
      await tx.channelStream.deleteMany({ where: { channelId } });
      await tx.playlistChannel.deleteMany({ where: { channelId } });

      if (streamIds.length > 0) {
        await tx.stream.deleteMany({ where: { id: { in: streamIds } } });
      }

      await tx.channel.delete({ where: { id: channelId } });
    });
  }

  private async deleteOwnedPlaylist(playlistId: string): Promise<void> {
    const relations = await this.prisma.playlistChannel.findMany({
      where: { playlistId },
      select: { channelId: true },
    });

    for (const relation of relations) {
      await this.deleteOwnedChannel(relation.channelId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.playlistTimezone.deleteMany({ where: { playlistId } });
      await tx.playlist.delete({ where: { id: playlistId } });
    });
  }

  private async getChannelForClone(channelId: string) {
    const source = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        channelStreams: { include: { stream: true }, orderBy: [{ priority: 'asc' }] },
        channelTimezones: { orderBy: [{ priority: 'asc' }] },
      },
    });

    if (!source) {
      throw new NotFoundException('Channel not found');
    }

    return source;
  }

  private async cloneChannelToPlaylist(
    source: Awaited<ReturnType<CatalogService['getChannelForClone']>>,
    playlistId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const channel = await tx.channel.create({
        data: {
          title: `${source.title} copy`,
          description: source.description,
          enabled: source.enabled,
          defaultDelaySeconds: source.defaultDelaySeconds,
          defaultScale: source.defaultScale,
        },
      });

      await tx.playlistChannel.create({ data: { playlistId, channelId: channel.id, enabled: true, priority: 0 } });

      for (const relation of source.channelStreams) {
        const stream = await tx.stream.create({
          data: {
            title: relation.stream.title,
            providerId: relation.stream.providerId,
            streamKey: relation.stream.streamKey,
            directUrl: relation.stream.directUrl,
            userAgent: relation.stream.userAgent,
            enabled: relation.stream.enabled,
            priority: relation.stream.priority,
          },
        });
        await tx.channelStream.create({
          data: {
            channelId: channel.id,
            streamId: stream.id,
            enabled: relation.enabled,
            priority: relation.priority,
          },
        });
      }

      if (source.channelTimezones.length > 0) {
        await tx.channelTimezone.createMany({
          data: source.channelTimezones.map((timezone) => ({
            channelId: channel.id,
            timezonePresetId: timezone.timezonePresetId,
            priority: timezone.priority,
          })),
        });
      }

      return tx.playlistChannel.findFirst({
        where: { playlistId, channelId: channel.id },
        include: { channel: { include: { _count: { select: { channelStreams: true, channelTimezones: true } } } } },
      });
    });
  }

  private normalizeRelationData(body: CatalogRelationBody): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if ('enabled' in body) {
      data.enabled = booleanOrDefault(body.enabled, true);
    }

    if ('priority' in body) {
      data.priority = numberOrDefault(body.priority, 0);
    }

    return data;
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
