import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module.js';
import { SourceSettingsService } from './source-settings.service.js';

@Module({
  imports: [ConfigModule],
  providers: [SourceSettingsService],
  exports: [SourceSettingsService],
})
export class SettingsCoreModule {}
