import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FramesModule } from '../frames/frames.module.js';
import { LogsModule } from '../logs/logs.module.js';
import {
  TelegramWebhookController,
  TelegramWebhookStatusController,
} from './telegram-webhook.controller.js';
import { TelegramPublicationService } from './telegram-publication.service.js';
import { TelegramCommentIngestService } from './telegram-comment-ingest.service.js';
import {
  TelegramBansController,
  TelegramCommentsController,
} from './telegram-moderation.controller.js';
import { TelegramModerationService } from './telegram-moderation.service.js';
import { TelegramSettingsController } from './telegram-settings.controller.js';
import { TelegramSettingsService } from './telegram-settings.service.js';
import { TelegramService } from './telegram.service.js';
import { TelegramUpdateService } from './telegram-update.service.js';
import { TelegramWebhookService } from './telegram-webhook.service.js';

@Module({
  imports: [AuthModule, FramesModule, LogsModule],
  controllers: [
    TelegramWebhookController,
    TelegramWebhookStatusController,
    TelegramSettingsController,
    TelegramCommentsController,
    TelegramBansController,
  ],
  providers: [
    TelegramService,
    TelegramPublicationService,
    TelegramUpdateService,
    TelegramWebhookService,
    TelegramSettingsService,
    TelegramCommentIngestService,
    TelegramModerationService,
  ],
  exports: [
    TelegramService,
    TelegramPublicationService,
    TelegramWebhookService,
    TelegramSettingsService,
  ],
})
export class TelegramModule {}
