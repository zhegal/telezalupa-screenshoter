import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { readFile } from 'node:fs/promises';
import { PLAYLIST_CONFIG, type PlaylistConfig } from '../config/playlist.config.js';
import { PlaylistNormalizerService } from './playlist-normalizer.service.js';
import { PlaylistStateService } from './playlist-state.service.js';

@Injectable()
export class PlaylistLoaderService {
  private readonly logger = new Logger(PlaylistLoaderService.name);

  constructor(
    @Inject(PLAYLIST_CONFIG) private readonly playlistConfig: PlaylistConfig,
    @Inject(PlaylistNormalizerService) private readonly normalizer: PlaylistNormalizerService,
    @Inject(PlaylistStateService) private readonly playlistState: PlaylistStateService,
  ) {}

  async getPlaylistUrls(): Promise<string[]> {
    try {
      const body = await readFile(this.playlistConfig.filePath, 'utf8');
      const parsed = JSON.parse(body);

      if (!Array.isArray(parsed)) {
        this.logger.error(`Playlist config must be an array: ${this.playlistConfig.filePath}`);
        return [];
      }

      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    } catch (err) {
      this.logger.error(`Playlist config load failed: ${this.getErrorMessage(err)}`);
      return [];
    }
  }

  async loadPlaylist(url: string, force = false): Promise<boolean> {
    const state = this.playlistState.getPlaylistState(url);

    if (state.loading) {
      return state.channels.length > 0;
    }

    if (!force && state.channels.length > 0) {
      return true;
    }

    state.loading = true;

    try {
      this.logger.log(`Loading playlist: ${url}`);

      const response = await axios.get<string>(url, {
        timeout: this.playlistConfig.requestTimeoutMs,
        responseType: 'text',
        transformResponse: [(data) => data],
        validateStatus: () => true,
      });

      if (response.status !== 200) {
        this.logger.error(`Playlist HTTP status ${response.status}: ${url}`);
        return state.channels.length > 0;
      }

      const channels = this.normalizer.normalizeJsonPlaylist(response.data);

      if (channels.length === 0) {
        this.logger.error(`Playlist is empty or invalid: ${url}`);
        return state.channels.length > 0;
      }

      state.channels = channels;
      state.channelQueue = [];

      this.logger.log(`Playlist loaded: ${channels.length} channels from ${url}`);

      return true;
    } catch (err) {
      this.logger.error(`Playlist load failed: ${url}: ${this.getErrorMessage(err)}`);
      return state.channels.length > 0;
    } finally {
      state.loading = false;
    }
  }

  async reloadAllPlaylists(): Promise<void> {
    const playlistUrls = await this.getPlaylistUrls();

    await Promise.all(playlistUrls.map((url) => this.loadPlaylist(url, true)));
  }

  private getErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
