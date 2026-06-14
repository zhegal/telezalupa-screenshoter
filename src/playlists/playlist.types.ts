import type { Channel } from '../channels/channel.types.js';

export interface PlaylistState {
  url: string;
  channels: Channel[];
  channelQueue: Channel[];
  loading: boolean;
  lastLoadedAt?: string;
  lastLoadError?: string | null;
}

export interface SelectedChannel {
  playlistUrl: string;
  channel: Channel;
  currentLeft: number;
  total: number;
}
