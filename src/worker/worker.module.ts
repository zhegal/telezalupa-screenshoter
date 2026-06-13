import { Module } from '@nestjs/common';
import { CaptionsModule } from '../captions/captions.module.js';
import { CaptureModule } from '../capture/capture.module.js';
import { PlaylistsModule } from '../playlists/playlists.module.js';
import { TelegramModule } from '../telegram/telegram.module.js';
import { SchedulerService } from './scheduler.service.js';
import { WorkerService } from './worker.service.js';
import { WorkerStateService } from './worker-state.service.js';

@Module({
  imports: [CaptionsModule, CaptureModule, PlaylistsModule, TelegramModule],
  providers: [SchedulerService, WorkerService, WorkerStateService],
  exports: [WorkerService, WorkerStateService],
})
export class WorkerModule {}
