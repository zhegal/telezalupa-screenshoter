import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { WorkerService } from '../worker/worker.service.js';

@Controller('system')
@UseGuards(SessionAuthGuard)
export class SystemController {
  constructor(@Inject(WorkerService) private readonly worker: WorkerService) {}

  @Get('status')
  async status() {
    const worker = await this.worker.getFreshStatus();

    return {
      status: 'ok',
      source: worker.activeChannelSource,
      activeChannelSource: worker.activeChannelSource,
      jsonSourceAvailable: worker.jsonSourceAvailable,
      databaseSourceAvailable: worker.databaseSourceAvailable,
      databaseSourceImplemented: worker.databaseSourceImplemented,
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      worker,
      now: new Date().toISOString(),
    };
  }
}
