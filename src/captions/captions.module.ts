import { Module } from '@nestjs/common';
import { ChannelTimeService } from '../channels/channel-time.service.js';
import { CaptionBuilderService } from './caption-builder.service.js';

@Module({
  providers: [CaptionBuilderService, ChannelTimeService],
  exports: [CaptionBuilderService],
})
export class CaptionsModule {}
