import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { WorkerModule } from './worker/worker.module.js';

@Module({
  imports: [ConfigModule, PrismaModule, HealthModule, AuthModule, WorkerModule],
})
export class AppModule {}
