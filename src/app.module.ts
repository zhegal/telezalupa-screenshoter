import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { LogsModule } from './logs/logs.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RuntimeModule } from './runtime/runtime.module.js';
import { SystemModule } from './system/system.module.js';
import { WorkerModule } from './worker/worker.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    CatalogModule,
    LogsModule,
    WorkerModule,
    RuntimeModule,
    SystemModule,
  ],
})
export class AppModule {}
