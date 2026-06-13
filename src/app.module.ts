import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { WorkerModule } from './worker/worker.module.js';

@Module({
  imports: [ConfigModule, HealthModule, WorkerModule],
})
export class AppModule {}
