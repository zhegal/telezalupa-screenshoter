import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { WorkerService } from '../worker/worker.service.js';

@Controller('system')
@UseGuards(SessionAuthGuard)
export class SystemController {
  constructor(@Inject(WorkerService) private readonly worker: WorkerService) {}

  @Get('status')
  status() {
    return {
      status: 'ok',
      source: 'json',
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      worker: this.worker.getStatus(),
      now: new Date().toISOString(),
    };
  }
}
