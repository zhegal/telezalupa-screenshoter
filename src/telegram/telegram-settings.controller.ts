import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { TelegramSettingsService } from './telegram-settings.service.js';

interface UpdateTelegramSettingsBody {
  autoPinEnabled: unknown;
  reactionThreshold: unknown;
}

@Controller('telegram/settings')
@UseGuards(SessionAuthGuard)
export class TelegramSettingsController {
  constructor(
    @Inject(TelegramSettingsService) private readonly settings: TelegramSettingsService,
  ) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Patch()
  update(@Body() body: UpdateTelegramSettingsBody) {
    return this.settings.update(body);
  }
}
