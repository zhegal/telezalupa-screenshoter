import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { TelegramModerationService } from './telegram-moderation.service.js';

interface NoteBody {
  note?: unknown;
}

@Controller('telegram/comments')
@UseGuards(SessionAuthGuard)
export class TelegramCommentsController {
  constructor(
    @Inject(TelegramModerationService)
    private readonly moderation: TelegramModerationService,
  ) {}

  @Get()
  list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.moderation.listComments({ limit, offset });
  }

  @Post(':id/ban')
  ban(@Param('id') id: string, @Body() body: NoteBody) {
    return this.moderation.banCommentAuthor(id, body.note);
  }
}

@Controller('telegram/bans')
@UseGuards(SessionAuthGuard)
export class TelegramBansController {
  constructor(
    @Inject(TelegramModerationService)
    private readonly moderation: TelegramModerationService,
  ) {}

  @Patch(':id')
  updateNote(@Param('id') id: string, @Body() body: NoteBody) {
    return this.moderation.updateBanNote(id, body.note);
  }
}
