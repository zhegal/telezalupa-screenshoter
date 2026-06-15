import { Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { WorkerService } from './worker.service.js';

@Controller('worker')
@UseGuards(SessionAuthGuard)
export class WorkerController {
  constructor(@Inject(WorkerService) private readonly worker: WorkerService) {}

  @Get('status')
  status() {
    return this.worker.getFreshStatus();
  }

  @Post('start')
  @HttpCode(200)
  async start() {
    const result = this.worker.start();

    return { ...result, worker: await this.worker.getFreshStatus() };
  }

  @Post('stop')
  @HttpCode(200)
  async stop() {
    const result = this.worker.stop();

    return { ...result, worker: await this.worker.getFreshStatus() };
  }

  @Post('restart')
  @HttpCode(200)
  async restart() {
    const result = await this.worker.restart();

    return { ...result, worker: await this.worker.getFreshStatus() };
  }

  @Post('run-once')
  @HttpCode(200)
  async runOnce() {
    const result = await this.worker.runOnce({ allowStopped: true });

    return { ...result, worker: await this.worker.getFreshStatus() };
  }
}
