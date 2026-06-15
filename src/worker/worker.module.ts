import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CaptionsModule } from '../captions/captions.module.js';
import { CaptureModule } from '../capture/capture.module.js';
import { LogsModule } from '../logs/logs.module.js';
import { PlaylistsModule } from '../playlists/playlists.module.js';
import { SettingsCoreModule } from '../settings/settings-core.module.js';
import { TelegramModule } from '../telegram/telegram.module.js';
import { SchedulerService } from './scheduler.service.js';
import { WorkerController } from './worker.controller.js';
import { WorkerService } from './worker.service.js';
import { WorkerStateService } from './worker-state.service.js';

@Module({
  imports: [AuthModule, CaptionsModule, CaptureModule, LogsModule, PlaylistsModule, SettingsCoreModule, TelegramModule],
  controllers: [WorkerController],
  providers: [SchedulerService, WorkerService, WorkerStateService],
  exports: [WorkerService, WorkerStateService],
})
export class WorkerModule {}
