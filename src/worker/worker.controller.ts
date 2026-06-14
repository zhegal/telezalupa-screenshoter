import { Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { WorkerService } from './worker.service.js';

@Controller('worker')
@UseGuards(SessionAuthGuard)
export class WorkerController {
  constructor(@Inject(WorkerService) private readonly worker: WorkerService) {}

  @Get('status')
  status() {
    return this.worker.getStatus();
  }

  @Post('start')
  @HttpCode(200)
  start() {
    return this.worker.start();
  }

  @Post('stop')
  @HttpCode(200)
  stop() {
    return this.worker.stop();
  }

  @Post('restart')
  @HttpCode(200)
  restart() {
    return this.worker.restart();
  }

  @Post('run-once')
  @HttpCode(200)
  runOnce() {
    return this.worker.runOnce({ allowStopped: true });
  }
}
