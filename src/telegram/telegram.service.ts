import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import { TELEGRAM_CONFIG, type TelegramConfig } from '../config/telegram.config.js';
import { RuntimeLogService } from '../logs/runtime-log.service.js';
import type {
  SendPhotoResult,
  TelegramApiResponse,
  TelegramMessageResult,
} from './telegram.types.js';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @Inject(TELEGRAM_CONFIG) private readonly telegramConfig: TelegramConfig,
    @Inject(RuntimeLogService) private readonly logs: RuntimeLogService,
  ) {}

  async sendPhoto(photoBuffer: Buffer, caption: string, chatId?: string): Promise<SendPhotoResult> {
    if (!this.telegramConfig.botToken || !(chatId || this.telegramConfig.defaultChatId)) {
      this.logger.error('Telegram bot token or default chat id is not configured');
      this.logs.add('error', 'telegram', 'Telegram bot token or default chat id is not configured');
      return { ok: false, errorMessage: 'Telegram bot token or default chat id is not configured' };
    }

    const form = new FormData();

    form.append('chat_id', chatId || this.telegramConfig.defaultChatId);
    form.append('parse_mode', 'HTML');
    form.append('caption', caption);
    form.append('photo', photoBuffer, {
      filename: 'screenshot.jpg',
      contentType: 'image/jpeg',
    });

    try {
      const response = await axios.post<TelegramApiResponse<TelegramMessageResult>>(
        `https://api.telegram.org/bot${this.telegramConfig.botToken}/sendPhoto`,
        form,
        {
          timeout: this.telegramConfig.timeoutMs,
          headers: form.getHeaders(),
          validateStatus: () => true,
        },
      );

      if (response.status === 200 && response.data?.ok) {
        const messageId = response.data.result?.message_id;
        this.logger.log(`Sent to TG${messageId ? `, message_id=${messageId}` : ''}`);
        return { ok: true, messageId };
      }

      const errorMessage = `TG Status: ${response.status} Body: ${JSON.stringify(response.data).slice(0, 500)}`;
      this.logger.error(errorMessage);
      this.logs.add('error', 'telegram', 'Telegram API returned an error', {
        status: response.status,
        body: response.data,
      });
      return { ok: false, errorMessage };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Send failed: ${errorMessage}`);
      this.logs.add('error', 'telegram', 'Telegram send failed', { error: errorMessage });
      return { ok: false, errorMessage };
    }
  }
}
