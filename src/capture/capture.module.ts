import { Module } from '@nestjs/common';
import { LogsModule } from '../logs/logs.module.js';
import { FfmpegCaptureService } from './ffmpeg-capture.service.js';

@Module({
  imports: [LogsModule],
  providers: [FfmpegCaptureService],
  exports: [FfmpegCaptureService],
})
export class CaptureModule {}
