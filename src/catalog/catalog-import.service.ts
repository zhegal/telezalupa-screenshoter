import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { readFile } from 'node:fs/promises';
import { PLAYLIST_CONFIG, type PlaylistConfig } from '../config/playlist.config.js';
import { PlaylistNormalizerService } from '../playlists/playlist-normalizer.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Channel } from '../channels/channel.types.js';
import type {
  ImportApplyRequest,
  ImportApplyResult,
  ImportPreviewRequest,
  ImportPreviewResponse,
  ImportPreviewRow,
  ImportProviderCandidate,
  ImportTimezonePreview,
  NormalizedTimezone,
} from './catalog-import.types.js';

@Injectable()
export class CatalogImportService {
  constructor(
    @Inject(PLAYLIST_CONFIG) private readonly playlistConfig: PlaylistConfig,
    @Inject(PlaylistNormalizerService) private readonly normalizer: PlaylistNormalizerService,
    private readonly prisma: PrismaService,
  ) {}

  async getSources() {
    return {
      items: await this.getPlaylistUrls(),
    };
  }

  async preview(request: ImportPreviewRequest): Promise<ImportPreviewResponse> {
    const channels = await this.loadChannels(request);
    const [providers, timezonePresets, duplicateKeys] = await Promise.all([
      this.prisma.provider.findMany({
        where: {
          enabled: true,
          urlTemplate: { contains: '{streamKey}' },
        },
      }),
      this.prisma.timezonePreset.findMany({ select: { timezone: true, label: true } }),
      this.getDuplicateKeys(request),
    ]);
    const timezoneKeys = new Set(timezonePresets.map((item) => this.timezoneKey(item.timezone, item.label)));
    const rows = channels.map((channel, index) =>
      this.buildPreviewRow(channel, index, providers, timezoneKeys, duplicateKeys, Boolean(request.skipExactDuplicates)),
    );

    return {
      summary: this.buildSummary(rows),
      rows,
    };
  }

  async apply(request: ImportApplyRequest): Promise<ImportApplyResult> {
    const preview = await this.preview(request);
    const selection = new Map((request.rows || []).map((row) => [row.rowId, row.selectedProviderId || null]));
    let playlistId = request.playlistId || null;
    let createdPlaylist = false;
    const result: ImportApplyResult = {
      playlistId: null,
      createdPlaylist: false,
      createdChannels: 0,
      createdStreams: 0,
      createdPlaylistLinks: 0,
      createdChannelStreamLinks: 0,
      createdTimezonePresets: 0,
      reusedTimezonePresets: 0,
      skipped: 0,
      failed: 0,
    };

    if (request.targetMode === 'newPlaylist') {
      const title = this.requiredString(request.playlistTitle, 'playlistTitle');
      const playlist = await this.prisma.playlist.create({ data: { title } });
      playlistId = playlist.id;
      createdPlaylist = true;
    } else {
      playlistId = this.requiredString(request.playlistId, 'playlistId');
      await this.ensurePlaylist(playlistId);
    }

    result.playlistId = playlistId;
    result.createdPlaylist = createdPlaylist;

    for (const row of preview.rows) {
      if (!row.valid || row.importMode === 'skip') {
        result.skipped += 1;
        continue;
      }

      try {
        const selectedProviderId = selection.has(row.rowId) ? selection.get(row.rowId) : row.selectedProviderId;
        const selectedCandidate = selectedProviderId
          ? row.providerCandidates.find((candidate) => candidate.providerId === selectedProviderId)
          : null;

        if (selectedProviderId && !selectedCandidate) {
          result.failed += 1;
          continue;
        }

        const channel = await this.prisma.channel.create({
          data: {
            title: row.title,
            description: row.description || null,
            enabled: true,
            defaultDelaySeconds: row.delay,
            defaultScale: row.scale || null,
          },
        });
        result.createdChannels += 1;

        const stream = await this.prisma.stream.create({
          data: {
            title: row.title,
            providerId: selectedCandidate?.providerId || null,
            streamKey: selectedCandidate?.streamKey || null,
            directUrl: selectedCandidate ? null : row.originalUrl,
            userAgent: row.userAgent || null,
            enabled: true,
          },
        });
        result.createdStreams += 1;

        await this.prisma.playlistChannel.create({ data: { playlistId, channelId: channel.id } });
        result.createdPlaylistLinks += 1;
        await this.prisma.channelStream.create({ data: { channelId: channel.id, streamId: stream.id } });
        result.createdChannelStreamLinks += 1;

        for (const timezone of row.timezones) {
          const preset = await this.prisma.timezonePreset.upsert({
            where: {
              timezone_label: {
                timezone: timezone.timezone,
                label: timezone.label,
              },
            },
            update: {},
            create: {
              timezone: timezone.timezone,
              label: timezone.label,
            },
          });

          if (timezone.existing) {
            result.reusedTimezonePresets += 1;
          } else {
            result.createdTimezonePresets += 1;
          }

          await this.prisma.channelTimezone.create({
            data: {
              channelId: channel.id,
              timezonePresetId: preset.id,
            },
          });
        }
      } catch {
        result.failed += 1;
      }
    }

    return result;
  }

  private async loadChannels(request: ImportPreviewRequest): Promise<Channel[]> {
    const body =
      request.sourceType === 'paste'
        ? this.requiredString(request.json, 'json')
        : await this.loadExistingSource(this.requiredString(request.sourceUrl, 'sourceUrl'));

    try {
      return this.normalizer.normalizeJsonPlaylist(body);
    } catch (err) {
      throw new BadRequestException(`Invalid JSON playlist: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async loadExistingSource(sourceUrl: string): Promise<string> {
    const urls = await this.getPlaylistUrls();

    if (!urls.includes(sourceUrl)) {
      throw new BadRequestException('sourceUrl is not listed in data/playlists.json');
    }

    const response = await axios.get<string>(sourceUrl, {
      timeout: this.playlistConfig.requestTimeoutMs,
      responseType: 'text',
      transformResponse: [(data) => data],
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      throw new BadRequestException(`Source returned HTTP ${response.status}`);
    }

    return response.data;
  }

  private async getPlaylistUrls(): Promise<string[]> {
    const body = await readFile(this.playlistConfig.filePath, 'utf8');
    const parsed = JSON.parse(body);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  private async getDuplicateKeys(request: ImportPreviewRequest): Promise<Set<string>> {
    if (!request.skipExactDuplicates || request.targetMode !== 'existingPlaylist' || !request.playlistId) {
      return new Set();
    }

    const links = await this.prisma.playlistChannel.findMany({
      where: { playlistId: request.playlistId },
      include: {
        channel: {
          include: {
            channelStreams: {
              include: { stream: true },
            },
          },
        },
      },
    });

    return new Set(
      links.flatMap((link) =>
        link.channel.channelStreams.map((relation) =>
          this.duplicateKey(link.channel.title, relation.stream.directUrl, relation.stream.providerId, relation.stream.streamKey),
        ),
      ),
    );
  }

  private buildPreviewRow(
    channel: Channel,
    index: number,
    providers: Array<{ id: string; title: string; urlTemplate: string }>,
    timezoneKeys: Set<string>,
    duplicateKeys: Set<string>,
    skipDuplicates: boolean,
  ): ImportPreviewRow {
    const candidates = this.findProviderCandidates(channel.url, providers);
    const selected = candidates.length === 1 ? candidates[0] : null;
    const timezones = this.normalizeTimezones(channel.timezones).map<ImportTimezonePreview>((item) => ({
      timezone: item[0],
      label: item[1],
      existing: timezoneKeys.has(this.timezoneKey(item[0], item[1])),
    }));
    const errors: string[] = [];

    if (!channel.title) errors.push('title is empty');
    if (!channel.url) errors.push('url is empty');

    const duplicateKey = selected
      ? this.duplicateKey(channel.title, null, selected.providerId, selected.streamKey)
      : this.duplicateKey(channel.title, channel.url, null, null);
    const duplicate = skipDuplicates && duplicateKeys.has(duplicateKey);

    return {
      rowId: String(index),
      title: channel.title,
      description: channel.description,
      originalUrl: channel.url,
      importMode: duplicate ? 'skip' : candidates.length > 0 ? 'providerSuggestion' : 'directUrl',
      providerCandidates: candidates,
      selectedProviderId: selected?.providerId || null,
      computedStreamKey: selected?.streamKey || null,
      timezones,
      scale: channel.scale,
      delay: channel.delay,
      userAgent: channel['user-agent'],
      valid: errors.length === 0,
      errors,
    };
  }

  private findProviderCandidates(
    url: string,
    providers: Array<{ id: string; title: string; urlTemplate: string }>,
  ): ImportProviderCandidate[] {
    return providers
      .map((provider) => {
        const [prefix, suffix] = provider.urlTemplate.split('{streamKey}');

        if (suffix === undefined) {
          return null;
        }

        if (prefix && !url.startsWith(prefix)) {
          return null;
        }

        if (suffix && !url.endsWith(suffix)) {
          return null;
        }

        const start = prefix.length;
        const end = suffix ? url.length - suffix.length : url.length;
        const streamKey = url.slice(start, end);

        if (!streamKey) {
          return null;
        }

        return {
          providerId: provider.id,
          title: provider.title,
          streamKey,
          suggested: true,
        };
      })
      .filter((item): item is ImportProviderCandidate => Boolean(item));
  }

  private buildSummary(rows: ImportPreviewRow[]) {
    const validRows = rows.filter((row) => row.valid && row.importMode !== 'skip');
    const uniqueCreateTimezones = new Set(
      validRows.flatMap((row) =>
        row.timezones
          .filter((timezone) => !timezone.existing)
          .map((timezone) => this.timezoneKey(timezone.timezone, timezone.label)),
      ),
    );
    const reusedTimezones = validRows.reduce(
      (count, row) => count + row.timezones.filter((timezone) => timezone.existing).length,
      0,
    );

    return {
      totalRows: rows.length,
      validRows: validRows.length,
      invalidRows: rows.filter((row) => !row.valid).length,
      channelsToCreate: validRows.length,
      streamsToCreate: validRows.length,
      playlistLinksToCreate: validRows.length,
      timezonePresetsToReuse: reusedTimezones,
      timezonePresetsToCreate: uniqueCreateTimezones.size,
      providerSuggestionsCount: validRows.filter((row) => row.providerCandidates.length > 0).length,
      directUrlStreamsCount: validRows.filter((row) => row.providerCandidates.length === 0).length,
      skippedDuplicatesCount: rows.filter((row) => row.importMode === 'skip').length,
    };
  }

  private normalizeTimezones(value: unknown): NormalizedTimezone[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (item): item is NormalizedTimezone =>
        Array.isArray(item) &&
        typeof item[0] === 'string' &&
        item[0].trim().length > 0 &&
        typeof item[1] === 'string' &&
        item[1].trim().length > 0,
    );
  }

  private timezoneKey(timezone: string, label: string): string {
    return `${timezone}\n${label}`;
  }

  private duplicateKey(
    title: string,
    directUrl: string | null,
    providerId: string | null,
    streamKey: string | null,
  ): string {
    return `${title}\n${directUrl || ''}\n${providerId || ''}\n${streamKey || ''}`;
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required`);
    }

    return value.trim();
  }

  private async ensurePlaylist(playlistId: string): Promise<void> {
    const playlist = await this.prisma.playlist.findUnique({ where: { id: playlistId } });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }
  }
}
