import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import { TELEGRAM_CONFIG, type TelegramConfig } from '../config/telegram.config.js';
import { RuntimeLogService } from '../logs/runtime-log.service.js';
import type {
  SendPhotoResult,
  TelegramApiResponse,
  TelegramMessageResult,
  TelegramWebhookInfo,
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
        const result = response.data.result;
        const messageId = result?.message_id;
        this.logger.log(`Sent to TG${messageId ? `, message_id=${messageId}` : ''}`);
        return {
          ok: true,
          messageId,
          chatId: result?.chat?.id === undefined ? undefined : String(result.chat.id),
          publishedAt: result?.date ? new Date(result.date * 1000) : undefined,
        };
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

  async getWebhookInfo(): Promise<TelegramWebhookInfo> {
    return this.callApi<TelegramWebhookInfo>('getWebhookInfo', {});
  }

  async setWebhook(input: {
    url: string;
    secretToken: string;
    allowedUpdates: string[];
  }): Promise<boolean> {
    return this.callApi<boolean>('setWebhook', {
      url: input.url,
      secret_token: input.secretToken,
      allowed_updates: input.allowedUpdates,
      drop_pending_updates: false,
    });
  }

  async pinChatMessage(chatId: string, messageId: number): Promise<boolean> {
    return this.callApi<boolean>('pinChatMessage', {
      chat_id: chatId,
      message_id: messageId,
      disable_notification: true,
    });
  }

  async deleteMessage(chatId: string, messageId: number): Promise<boolean> {
    return this.callApi<boolean>('deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  async banChatMember(chatId: string, userId: string): Promise<boolean> {
    return this.callApi<boolean>('banChatMember', {
      chat_id: chatId,
      user_id: Number(userId),
      revoke_messages: true,
    });
  }

  private async callApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
    if (!this.telegramConfig.botToken) {
      throw new Error('Telegram bot token is not configured');
    }

    const response = await axios.post<TelegramApiResponse<T>>(
      `https://api.telegram.org/bot${this.telegramConfig.botToken}/${method}`,
      body,
      {
        timeout: this.telegramConfig.timeoutMs,
        validateStatus: () => true,
      },
    );

    if (response.status !== 200 || !response.data?.ok || response.data.result === undefined) {
      throw new Error(
        `Telegram ${method} failed: status=${response.status} ${response.data?.description || ''}`.trim(),
      );
    }

    return response.data.result;
  }
}
