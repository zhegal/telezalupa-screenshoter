import { Inject, Injectable } from '@nestjs/common';
import { escapeHtml } from '../common/utils/html.js';
import { formatDateParts, formatTimeParts } from '../common/utils/time.js';
import type { Channel } from '../channels/channel.types.js';
import { ChannelTimeService } from '../channels/channel-time.service.js';

@Injectable()
export class CaptionBuilderService {
  constructor(@Inject(ChannelTimeService) private readonly channelTimeService: ChannelTimeService) {}

  buildCaption(channel: Channel): string {
    const timeText = this.buildTimeLines(channel);
    const lines = [`📺 <b>${escapeHtml(channel.title)}</b>`];

    if (channel.description) {
      lines.push(`✍️ ${escapeHtml(channel.description)}`);
    }

    lines.push(timeText);

    return lines.join('\n');
  }

  private buildTimeLines(channel: Channel): string {
    const delaySeconds = this.channelTimeService.getDelaySeconds(channel);
    const now = new Date(Date.now() - delaySeconds * 1000);
    const zones = this.channelTimeService.normalizeTimezones(channel);
    const grouped = new Map<string, string[]>();

    zones.forEach(([timeZone, label]) => {
      const date = formatDateParts(now, timeZone);
      const { time } = formatTimeParts(now, timeZone);
      const key = `${date}, ${time}`;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      grouped.get(key).push(label);
    });

    const lines = Array.from(grouped.entries()).map(([dateTime, labels]) => {
      return `🕔 ${dateTime} (${escapeHtml(labels.join(', '))})`;
    });

    return lines.join('\n');
  }
}
