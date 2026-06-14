import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LogsController } from './logs.controller.js';
import { RuntimeLogService } from './runtime-log.service.js';

@Module({
  imports: [AuthModule],
  controllers: [LogsController],
  providers: [RuntimeLogService],
  exports: [RuntimeLogService],
})
export class LogsModule {}
