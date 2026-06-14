import { Injectable } from '@nestjs/common';
import type { PlaylistState } from './playlist.types.js';

@Injectable()
export class PlaylistStateService {
  private readonly states = new Map<string, PlaylistState>();

  getPlaylistState(url: string): PlaylistState {
    if (!this.states.has(url)) {
      this.states.set(url, {
        url,
        channels: [],
        channelQueue: [],
        loading: false,
      });
    }

    return this.states.get(url);
  }

  getAllPlaylistStates(): PlaylistState[] {
    return Array.from(this.states.values());
  }

  clear(): void {
    this.states.clear();
  }

  resetQueues(): void {
    for (const state of this.states.values()) {
      state.channelQueue = [];
    }
  }
}
