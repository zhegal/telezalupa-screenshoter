import { Injectable } from '@nestjs/common';
import { getLocalMinutes, isNowInsideInterval, parseTimeToMinutes } from '../common/utils/time.js';
import type { Channel } from './channel.types.js';
import { ChannelTimeService } from './channel-time.service.js';

@Injectable()
export class ChannelAvailabilityService {
  constructor(private readonly channelTimeService: ChannelTimeService) {}

  isAvailableNow(channel: Channel, date = new Date()): boolean {
    if (!Array.isArray(channel.available) || channel.available.length === 0) {
      return true;
    }

    const zones = this.channelTimeService.normalizeTimezones(channel);
    const timeZone = zones[0][0];
    const nowMinutes = getLocalMinutes(date, timeZone);

    return channel.available.some((item) => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const start = parseTimeToMinutes(item.start);
      const end = parseTimeToMinutes(item.end);

      if (start === null || end === null) {
        return false;
      }

      return isNowInsideInterval(nowMinutes, start, end);
    });
  }
}
