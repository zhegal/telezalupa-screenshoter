import {
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  UnauthorizedException,
  UseGuards,
  Body,
} from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import type { TelegramUpdate } from './telegram.types.js';
import { TelegramUpdateService } from './telegram-update.service.js';
import { TelegramWebhookService } from './telegram-webhook.service.js';

@Controller('telegram/webhook')
export class TelegramWebhookController {
  constructor(
    @Inject(TelegramWebhookService) private readonly webhook: TelegramWebhookService,
    @Inject(TelegramUpdateService) private readonly updates: TelegramUpdateService,
  ) {}

  @Post()
  async receive(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: TelegramUpdate,
  ) {
    if (!this.webhook.isSecretValid(secret)) {
      throw new UnauthorizedException('Invalid Telegram webhook secret');
    }

    return { ok: true, ...(await this.updates.process(update)) };
  }
}

@Controller('telegram/webhook/status')
@UseGuards(SessionAuthGuard)
export class TelegramWebhookStatusController {
  constructor(@Inject(TelegramWebhookService) private readonly webhook: TelegramWebhookService) {}

  @Get()
  status() {
    return this.webhook.getStatus();
  }
}
