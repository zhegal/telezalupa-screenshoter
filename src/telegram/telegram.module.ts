import { Module } from '@nestjs/common';
import { LogsModule } from '../logs/logs.module.js';
import { TelegramService } from './telegram.service.js';

@Module({
  imports: [LogsModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
