import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FrameFingerprintService } from './frame-fingerprint.service.js';
import { FrameStateService } from './frame-state.service.js';
import { ForbiddenFrameReferenceController } from './forbidden-frame-reference.controller.js';
import { ForbiddenFrameReferenceService } from './forbidden-frame-reference.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ForbiddenFrameReferenceController],
  providers: [FrameFingerprintService, FrameStateService, ForbiddenFrameReferenceService],
  exports: [FrameFingerprintService, FrameStateService, ForbiddenFrameReferenceService],
})
export class FramesModule {}
