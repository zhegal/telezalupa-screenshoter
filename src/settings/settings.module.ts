import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { WorkerModule } from '../worker/worker.module.js';
import { SettingsCoreModule } from './settings-core.module.js';
import { SourceSettingsController } from './source-settings.controller.js';

@Module({
  imports: [AuthModule, SettingsCoreModule, WorkerModule],
  controllers: [SourceSettingsController],
})
export class SettingsModule {}
