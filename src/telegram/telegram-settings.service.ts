import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const TELEGRAM_AUTO_PIN_ENABLED_KEY = 'telegram.autoPinEnabled';
export const TELEGRAM_PIN_REACTION_THRESHOLD_KEY = 'telegram.pinReactionThreshold';
export const DEFAULT_TELEGRAM_PIN_REACTION_THRESHOLD = 7;

export interface TelegramAutomationSettings {
  autoPinEnabled: boolean;
  reactionThreshold: number;
}

@Injectable()
export class TelegramSettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(): Promise<TelegramAutomationSettings> {
    const settings = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: [TELEGRAM_AUTO_PIN_ENABLED_KEY, TELEGRAM_PIN_REACTION_THRESHOLD_KEY],
        },
      },
    });
    const values = new Map(settings.map((setting) => [setting.key, setting.value]));

    return {
      autoPinEnabled: values.get(TELEGRAM_AUTO_PIN_ENABLED_KEY) === 'true',
      reactionThreshold: this.parseThreshold(values.get(TELEGRAM_PIN_REACTION_THRESHOLD_KEY)),
    };
  }

  async update(input: {
    autoPinEnabled: unknown;
    reactionThreshold: unknown;
  }): Promise<TelegramAutomationSettings> {
    if (typeof input.autoPinEnabled !== 'boolean') {
      throw new BadRequestException('autoPinEnabled must be a boolean');
    }

    if (!Number.isInteger(input.reactionThreshold) || Number(input.reactionThreshold) < 1) {
      throw new BadRequestException('reactionThreshold must be an integer of at least 1');
    }

    const reactionThreshold = Number(input.reactionThreshold);

    await this.prisma.$transaction([
      this.prisma.systemSetting.upsert({
        where: { key: TELEGRAM_AUTO_PIN_ENABLED_KEY },
        create: {
          key: TELEGRAM_AUTO_PIN_ENABLED_KEY,
          value: String(input.autoPinEnabled),
        },
        update: { value: String(input.autoPinEnabled) },
      }),
      this.prisma.systemSetting.upsert({
        where: { key: TELEGRAM_PIN_REACTION_THRESHOLD_KEY },
        create: {
          key: TELEGRAM_PIN_REACTION_THRESHOLD_KEY,
          value: String(reactionThreshold),
        },
        update: { value: String(reactionThreshold) },
      }),
    ]);

    return {
      autoPinEnabled: input.autoPinEnabled,
      reactionThreshold,
    };
  }

  private parseThreshold(value?: string): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1
      ? parsed
      : DEFAULT_TELEGRAM_PIN_REACTION_THRESHOLD;
  }
}
