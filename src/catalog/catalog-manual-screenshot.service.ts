import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CaptionBuilderService } from '../captions/caption-builder.service.js';
import { FfmpegCaptureService } from '../capture/ffmpeg-capture.service.js';
import type { Channel } from '../channels/channel.types.js';
import { RuntimeLogService } from '../logs/runtime-log.service.js';
import { DatabasePlaylistSelectorService } from '../playlists/database-playlist-selector.service.js';
import { TelegramService } from '../telegram/telegram.service.js';

export interface ManualScreenshotResult {
  ok: boolean;
  channelTitle?: string;
  messageId?: number;
  streamUrl?: string;
  errorMessage?: string;
}

@Injectable()
export class CatalogManualScreenshotService {
  constructor(
    @Inject(DatabasePlaylistSelectorService)
    private readonly databaseSelector: DatabasePlaylistSelectorService,
    @Inject(FfmpegCaptureService) private readonly capture: FfmpegCaptureService,
    @Inject(TelegramService) private readonly telegram: TelegramService,
    @Inject(CaptionBuilderService) private readonly captions: CaptionBuilderService,
    @Inject(RuntimeLogService) private readonly logs: RuntimeLogService,
  ) {}

  async sendPlaylistChannelNow(playlistId: string, channelId: string): Promise<ManualScreenshotResult> {
    const selected = await this.databaseSelector.getPlaylistChannel(playlistId, channelId);

    if (!selected) {
      throw new NotFoundException('Runnable playlist channel not found');
    }

    this.logs.add('info', 'worker', 'Manual screenshot requested', {
      playlistUrl: selected.playlistUrl,
      channelTitle: selected.channel.title,
    });

    const captured = await this.captureWithFallback(selected.channel, selected.playlistUrl);

    if (!captured) {
      return {
        ok: false,
        channelTitle: selected.channel.title,
        errorMessage: 'Screenshot capture failed',
      };
    }

    const sent = await this.telegram.sendPhoto(
      captured.photoBuffer,
      this.captions.buildCaption(selected.channel),
    );

    if (!sent.ok) {
      return {
        ok: false,
        channelTitle: selected.channel.title,
        streamUrl: captured.channel.url,
        errorMessage: sent.errorMessage || 'Telegram send failed',
      };
    }

    this.logs.add('info', 'telegram', 'Manual Telegram photo sent', {
      playlistUrl: selected.playlistUrl,
      channelTitle: selected.channel.title,
      streamUrl: captured.channel.url,
      messageId: sent.messageId,
    });

    return {
      ok: true,
      channelTitle: selected.channel.title,
      streamUrl: captured.channel.url,
      messageId: sent.messageId,
    };
  }

  private async captureWithFallback(
    channel: Channel,
    playlistUrl: string,
  ): Promise<{ channel: Channel; photoBuffer: Buffer } | null> {
    const streamCandidates = channel.streamCandidates?.length
      ? channel.streamCandidates
      : [{ id: 'default', title: channel.title, url: channel.url, userAgent: channel['user-agent'] }];

    for (const stream of streamCandidates) {
      const streamChannel: Channel = {
        ...channel,
        url: stream.url,
        'user-agent': stream.userAgent,
      };

      this.logs.add('info', 'worker', 'Trying manual stream', {
        playlistUrl,
        channelTitle: channel.title,
        streamTitle: stream.title,
        streamUrl: stream.url,
      });

      const photoBuffer = await this.capture.captureScreenshot(streamChannel);

      if (photoBuffer) {
        return { channel: streamChannel, photoBuffer };
      }
    }

    this.logs.add('error', 'ffmpeg', 'Manual screenshot capture failed', {
      playlistUrl,
      channelTitle: channel.title,
    });

    return null;
  }
}
