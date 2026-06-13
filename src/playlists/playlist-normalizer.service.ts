import { Injectable } from '@nestjs/common';
import type { Channel } from '../channels/channel.types.js';

@Injectable()
export class PlaylistNormalizerService {
  normalizeJsonPlaylist(body: string): Channel[] {
    const parsed = JSON.parse(body);
    const list = Array.isArray(parsed) ? parsed : parsed.channels;

    if (!Array.isArray(list)) {
      return [];
    }

    return list
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const record = item as Record<string, unknown>;

        return {
          title: typeof record.title === 'string' ? record.title.trim() : '',
          url: typeof record.url === 'string' ? record.url.trim() : '',
          description: typeof record.description === 'string' ? record.description.trim() : '',
          scale: typeof record.scale === 'string' ? record.scale.trim() : '',
          delay: Number.isFinite(Number(record.delay)) ? Number(record.delay) : null,
          timezones: Array.isArray(record.timezones) ? record.timezones : null,
          available: Array.isArray(record.available) ? record.available : null,
          'user-agent': typeof record['user-agent'] === 'string' ? record['user-agent'] : '',
        } as Channel;
      })
      .filter((item) => item.title && item.url);
  }
}
