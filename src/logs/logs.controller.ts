import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { RuntimeLogService } from './runtime-log.service.js';
import type { RuntimeLogScope } from './logs.types.js';

@Controller('logs')
@UseGuards(SessionAuthGuard)
export class LogsController {
  constructor(@Inject(RuntimeLogService) private readonly logs: RuntimeLogService) {}

  @Get('recent')
  recent(@Query('scope') scope?: RuntimeLogScope, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    const parsedLimit = Number(limit);
    const parsedOffset = Number(offset);

    return this.logs.recent(
      scope,
      Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : undefined,
      Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0,
    );
  }
}
