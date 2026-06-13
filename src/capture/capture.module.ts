import { Module } from '@nestjs/common';
import { FfmpegCaptureService } from './ffmpeg-capture.service.js';

@Module({
  providers: [FfmpegCaptureService],
  exports: [FfmpegCaptureService],
})
export class CaptureModule {}
