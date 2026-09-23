import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FramesModule } from '../frames/frames.module.js';
import { LogsModule } from '../logs/logs.module.js';
import {
  TelegramWebhookController,
  TelegramWebhookStatusController,
} from './telegram-webhook.controller.js';
import { TelegramPublicationService } from './telegram-publication.service.js';
import { TelegramService } from './telegram.service.js';
import { TelegramUpdateService } from './telegram-update.service.js';
import { TelegramWebhookService } from './telegram-webhook.service.js';

@Module({
  imports: [AuthModule, FramesModule, LogsModule],
  controllers: [TelegramWebhookController, TelegramWebhookStatusController],
  providers: [
    TelegramService,
    TelegramPublicationService,
    TelegramUpdateService,
    TelegramWebhookService,
  ],
  exports: [TelegramService, TelegramPublicationService, TelegramWebhookService],
})
export class TelegramModule {}
