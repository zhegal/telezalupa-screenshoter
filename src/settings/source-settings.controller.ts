import { Body, Controller, Delete, Get, HttpCode, Inject, Patch, Put, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { WorkerService } from '../worker/worker.service.js';
import { SourceSettingsService } from './source-settings.service.js';
import type { ChannelSource } from './source-settings.types.js';

interface SetActiveSourceBody {
  source: ChannelSource;
}

interface SaveJsonFileBody {
  content: string;
}

@Controller('settings/sources')
@UseGuards(SessionAuthGuard)
export class SourceSettingsController {
  constructor(
    @Inject(SourceSettingsService) private readonly sourceSettings: SourceSettingsService,
    @Inject(WorkerService) private readonly worker: WorkerService,
  ) {}

  @Get('status')
  status() {
    return this.sourceSettings.getStatus();
  }

  @Patch('active')
  async setActive(@Body() body: SetActiveSourceBody) {
    const status = await this.sourceSettings.setActiveChannelSource(body.source);
    const workerResult = await this.worker.restart();
    const worker = { ...workerResult, worker: await this.worker.getFreshStatus() };

    return { status, worker };
  }

  @Get('json-file')
  jsonFile() {
    return this.sourceSettings.getJsonFile();
  }

  @Put('json-file')
  async saveJsonFile(@Body() body: SaveJsonFileBody) {
    return this.sourceSettings.saveJsonFile(body.content);
  }

  @Delete('json-file')
  @HttpCode(200)
  async deleteJsonFile() {
    const result = await this.sourceSettings.deleteJsonFile();
    const workerResult = await this.worker.restart();
    const worker = { ...workerResult, worker: await this.worker.getFreshStatus() };

    return { ...result, worker };
  }
}
