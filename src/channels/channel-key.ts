import { createHash } from 'node:crypto';
import type { Channel } from './channel.types.js';

export function createDatabaseChannelKey(channelId: string): string {
  return `db:${channelId}`;
}

export function createJsonChannelKey(
  playlistUrl: string,
  channel: Pick<Channel, 'title' | 'url'>,
): string {
  const digest = createHash('sha256')
    .update(playlistUrl)
    .update('\0')
    .update(channel.title)
    .update('\0')
    .update(channel.url)
    .digest('hex');

  return `json:${digest}`;
}
