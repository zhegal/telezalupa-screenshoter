import { Module } from '@nestjs/common';
import { FrameFingerprintService } from './frame-fingerprint.service.js';
import { FrameStateService } from './frame-state.service.js';

@Module({
  providers: [FrameFingerprintService, FrameStateService],
  exports: [FrameFingerprintService, FrameStateService],
})
export class FramesModule {}
