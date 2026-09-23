import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { TELEGRAM_CONFIG, type TelegramConfig } from '../config/telegram.config.js';
import { RuntimeLogService } from '../logs/runtime-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TelegramService } from './telegram.service.js';
import type { TelegramWebhookInfo } from './telegram.types.js';

export const TELEGRAM_ALLOWED_UPDATES = [
  'message',
  'edited_message',
  'channel_post',
  'edited_channel_post',
  'message_reaction_count',
];

const WEBHOOK_SIGNATURE_SETTING = 'telegram.webhookConfigurationSignature';

@Injectable()
export class TelegramWebhookService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramWebhookService.name);
  private lastUpdateAt: string | null = null;

  constructor(
    @Inject(TELEGRAM_CONFIG) private readonly config: TelegramConfig,
    @Inject(TelegramService) private readonly telegram: TelegramService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RuntimeLogService) private readonly logs: RuntimeLogService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('Telegram webhook is not configured');
      return;
    }

    try {
      await this.ensureConfigured();
    } catch (err) {
      const error = this.getErrorMessage(err);
      this.logger.error(`Telegram webhook setup failed: ${error}`);
      this.logs.add('error', 'telegram', 'Telegram webhook setup failed', { error });
    }
  }

  isSecretValid(value?: string): boolean {
    if (!this.config.webhookSecret || !value) {
      return false;
    }

    const expected = Buffer.from(this.config.webhookSecret);
    const actual = Buffer.from(value);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  markUpdateReceived(): void {
    this.lastUpdateAt = new Date().toISOString();
  }

  async getStatus() {
    let remote: TelegramWebhookInfo | null = null;
    let error: string | null = null;

    if (this.isConfigured()) {
      try {
        remote = await this.telegram.getWebhookInfo();
      } catch (err) {
        error = this.getErrorMessage(err);
      }
    }

    return {
      configured: this.isConfigured(),
      expectedUrl: this.config.webhookUrl || null,
      lastUpdateAt: this.lastUpdateAt,
      remote,
      error,
    };
  }

  private async ensureConfigured(): Promise<void> {
    this.validateConfig();
    const [remote, storedSignature] = await Promise.all([
      this.telegram.getWebhookInfo(),
      this.prisma.systemSetting.findUnique({ where: { key: WEBHOOK_SIGNATURE_SETTING } }),
    ]);
    const signature = this.getConfigurationSignature();
    const allowedUpdatesMatch = this.sameStringSet(
      remote.allowed_updates ?? [],
      TELEGRAM_ALLOWED_UPDATES,
    );

    if (
      remote.url === this.config.webhookUrl &&
      allowedUpdatesMatch &&
      storedSignature?.value === signature
    ) {
      return;
    }

    await this.telegram.setWebhook({
      url: this.config.webhookUrl,
      secretToken: this.config.webhookSecret,
      allowedUpdates: TELEGRAM_ALLOWED_UPDATES,
    });
    await this.prisma.systemSetting.upsert({
      where: { key: WEBHOOK_SIGNATURE_SETTING },
      create: { key: WEBHOOK_SIGNATURE_SETTING, value: signature },
      update: { value: signature },
    });
    this.logs.add('info', 'telegram', 'Telegram webhook configured', {
      url: this.config.webhookUrl,
      allowedUpdates: TELEGRAM_ALLOWED_UPDATES,
    });
  }

  private isConfigured(): boolean {
    return Boolean(this.config.botToken && this.config.webhookUrl && this.config.webhookSecret);
  }

  private validateConfig(): void {
    if (!this.config.webhookUrl.startsWith('https://')) {
      throw new Error('TELEGRAM_WEBHOOK_URL must use HTTPS');
    }

    if (!/^[A-Za-z0-9_-]{1,256}$/.test(this.config.webhookSecret)) {
      throw new Error('TELEGRAM_WEBHOOK_SECRET contains unsupported characters');
    }
  }

  private getConfigurationSignature(): string {
    return createHash('sha256')
      .update(this.config.webhookUrl)
      .update('\0')
      .update(this.config.webhookSecret)
      .update('\0')
      .update([...TELEGRAM_ALLOWED_UPDATES].sort().join(','))
      .digest('hex');
  }

  private sameStringSet(left: string[], right: string[]): boolean {
    return [...left].sort().join(',') === [...right].sort().join(',');
  }

  private getErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
