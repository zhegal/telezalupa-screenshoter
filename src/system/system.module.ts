import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { WorkerModule } from '../worker/worker.module.js';
import { SystemController } from './system.controller.js';

@Module({
  imports: [AuthModule, WorkerModule],
  controllers: [SystemController],
})
export class SystemModule {}
