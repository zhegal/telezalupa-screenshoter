import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PLAYLIST_CONFIG, type PlaylistConfig } from '../config/playlist.config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type ChannelSource,
  type DatabaseSourceStatus,
  type JsonFileDeleteResult,
  type JsonFileResponse,
  type JsonFileSaveResult,
  type JsonSourceStatus,
  type SourceStatus,
} from './source-settings.types.js';

const ACTIVE_SOURCE_KEY = 'active_channel_source';

@Injectable()
export class SourceSettingsService {
  constructor(
    @Inject(PLAYLIST_CONFIG) private readonly playlistConfig: PlaylistConfig,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getStatus(): Promise<SourceStatus> {
    const [activeChannelSource, json, database] = await Promise.all([
      this.getActiveChannelSource(),
      this.getJsonStatus(),
      this.getDatabaseStatus(),
    ]);

    return {
      activeChannelSource,
      json,
      database,
      databaseSourceImplemented: database.implemented,
    };
  }

  async getActiveChannelSource(): Promise<ChannelSource> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: ACTIVE_SOURCE_KEY },
    });

    if (setting?.value === 'json' || setting?.value === 'database') {
      return setting.value;
    }

    const json = await this.getJsonStatus();
    return json.sourceAvailable ? 'json' : 'database';
  }

  async setActiveChannelSource(source: ChannelSource): Promise<SourceStatus> {
    if (source !== 'json' && source !== 'database') {
      throw new BadRequestException('Source must be "json" or "database"');
    }

    if (source === 'json') {
      const json = await this.getJsonStatus();

      if (!json.sourceAvailable) {
        throw new BadRequestException(json.error || 'JSON source is not available');
      }
    }

    await this.persistActiveChannelSource(source);

    return this.getStatus();
  }

  async getJsonFile(): Promise<JsonFileResponse> {
    const status = await this.getJsonStatus();

    if (!status.exists) {
      return { status, content: null };
    }

    return {
      status,
      content: await readFile(this.playlistConfig.filePath, 'utf8'),
    };
  }

  async saveJsonFile(content: string): Promise<JsonFileSaveResult> {
    const urls = this.parseJsonContent(content);
    await mkdir(dirname(this.playlistConfig.filePath), { recursive: true });
    const backupPath = await this.backupExistingJsonFile();
    await writeFile(this.playlistConfig.filePath, `${JSON.stringify(urls, null, 2)}\n`, 'utf8');

    return {
      status: await this.getJsonStatus(),
      backupPath,
    };
  }

  async deleteJsonFile(): Promise<JsonFileDeleteResult> {
    const before = await this.getJsonStatus();
    const backupPath = before.exists ? await this.backupExistingJsonFile() : null;
    let switchedToDatabase = false;

    if (before.exists) {
      try {
        await unlink(this.playlistConfig.filePath);
      } catch (err) {
        if (!this.isNotFoundError(err)) {
          throw err;
        }
      }
    }

    if ((await this.getActiveChannelSource()) === 'json') {
      await this.persistActiveChannelSource('database');
      switchedToDatabase = true;
    }

    return {
      status: await this.getJsonStatus(),
      backupPath,
      switchedToDatabase,
    };
  }

  async getJsonStatus(): Promise<JsonSourceStatus> {
    try {
      await stat(this.playlistConfig.filePath);
    } catch (err) {
      if (this.isNotFoundError(err)) {
        return {
          path: this.playlistConfig.filePath,
          exists: false,
          valid: false,
          sourceAvailable: false,
          sourceCount: 0,
          error: 'JSON playlist file is missing',
        };
      }

      return this.invalidJsonStatus(this.getErrorMessage(err));
    }

    try {
      const content = await readFile(this.playlistConfig.filePath, 'utf8');
      const urls = this.parseJsonContent(content);

      return {
        path: this.playlistConfig.filePath,
        exists: true,
        valid: true,
        sourceAvailable: true,
        sourceCount: urls.length,
        error: null,
      };
    } catch (err) {
      return this.invalidJsonStatus(this.getErrorMessage(err));
    }
  }

  async getDatabaseStatus(): Promise<DatabaseSourceStatus> {
    const [playlistCount, channelCount, streamCount, providerCount] = await Promise.all([
      this.prisma.playlist.count(),
      this.prisma.channel.count(),
      this.prisma.stream.count(),
      this.prisma.provider.count(),
    ]);

    return {
      implemented: true,
      sourceAvailable: true,
      playlistCount,
      channelCount,
      streamCount,
      providerCount,
    };
  }

  private async persistActiveChannelSource(source: ChannelSource): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key: ACTIVE_SOURCE_KEY },
      update: { value: source },
      create: { key: ACTIVE_SOURCE_KEY, value: source },
    });
  }

  private parseJsonContent(content: string): string[] {
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new BadRequestException(`Invalid JSON: ${this.getErrorMessage(err)}`);
    }

    if (!Array.isArray(parsed)) {
      throw new BadRequestException('JSON source must be an array of playlist URLs');
    }

    const invalidIndex = parsed.findIndex((item) => typeof item !== 'string' || item.trim().length === 0);

    if (invalidIndex >= 0) {
      throw new BadRequestException(`Playlist URL at index ${invalidIndex} must be a non-empty string`);
    }

    return parsed.map((item) => (item as string).trim());
  }

  private async backupExistingJsonFile(): Promise<string | null> {
    try {
      await stat(this.playlistConfig.filePath);
    } catch (err) {
      if (this.isNotFoundError(err)) {
        return null;
      }

      throw err;
    }

    const backupPath = join(
      dirname(this.playlistConfig.filePath),
      `playlists.${this.getBackupTimestamp()}.backup.json`,
    );
    await rename(this.playlistConfig.filePath, backupPath);

    return backupPath;
  }

  private invalidJsonStatus(error: string): JsonSourceStatus {
    return {
      path: this.playlistConfig.filePath,
      exists: true,
      valid: false,
      sourceAvailable: false,
      sourceCount: 0,
      error,
    };
  }

  private getBackupTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  private isNotFoundError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT';
  }

  private getErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
