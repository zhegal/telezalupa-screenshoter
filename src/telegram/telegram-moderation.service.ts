import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RuntimeLogService } from '../logs/runtime-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TelegramService } from './telegram.service.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_NOTE_LENGTH = 2000;

@Injectable()
export class TelegramModerationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TelegramService) private readonly telegram: TelegramService,
    @Inject(RuntimeLogService) private readonly logs: RuntimeLogService,
  ) {}

  async listComments(input: { limit?: string; offset?: string }) {
    const limit = this.parsePageValue(input.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
    const offset = this.parsePageValue(input.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const [items, total] = await Promise.all([
      this.prisma.telegramComment.findMany({
        orderBy: [{ messageCreatedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        include: {
          publication: {
            select: {
              id: true,
              channelTitle: true,
              chatId: true,
              messageId: true,
              publishedAt: true,
            },
          },
          ban: true,
        },
      }),
      this.prisma.telegramComment.count(),
    ]);

    return { items, total, limit, offset };
  }

  async banCommentAuthor(commentId: string, noteInput: unknown) {
    const note = this.parseNote(noteInput);
    const comment = await this.prisma.telegramComment.findUnique({
      where: { id: commentId },
      include: { ban: true },
    });

    if (!comment) {
      throw new NotFoundException('Telegram comment not found');
    }
    if (!comment.telegramUserId) {
      throw new BadRequestException('This comment has no Telegram user ID to ban');
    }
    if (comment.ban?.status === 'completed') {
      return comment.ban;
    }
    if (comment.ban?.status === 'pending') {
      return comment.ban;
    }

    let ban;

    try {
      ban = comment.ban
        ? await this.prisma.telegramUserBan.update({
            where: { id: comment.ban.id },
            data: { status: 'pending', errorMessage: null, note },
          })
        : await this.prisma.telegramUserBan.create({
            data: {
              commentId: comment.id,
              publicationId: comment.publicationId,
              discussionChatId: comment.discussionChatId,
              telegramUserId: comment.telegramUserId,
              authorUsername: comment.authorUsername,
              authorDisplayName: comment.authorDisplayName,
              note,
              status: 'pending',
            },
          });
    } catch (err) {
      if (!this.isUniqueConstraintError(err)) {
        throw err;
      }

      const concurrentBan = await this.prisma.telegramUserBan.findUnique({
        where: { commentId: comment.id },
      });
      if (concurrentBan) {
        return concurrentBan;
      }
      throw err;
    }

    try {
      const completed = await this.telegram.banChatMember(
        comment.discussionChatId,
        comment.telegramUserId,
      );
      if (!completed) {
        throw new Error('Telegram did not confirm banChatMember');
      }

      const saved = await this.prisma.telegramUserBan.update({
        where: { id: ban.id },
        data: {
          status: 'completed',
          errorMessage: null,
          bannedAt: new Date(),
        },
      });
      this.logs.add('info', 'telegram', 'Telegram discussion user banned', {
        commentId: comment.id,
        publicationId: comment.publicationId,
        telegramUserId: comment.telegramUserId,
      });
      return saved;
    } catch (err) {
      const error = this.getErrorMessage(err);
      await this.prisma.telegramUserBan.update({
        where: { id: ban.id },
        data: { status: 'error', errorMessage: error },
      });
      this.logs.add('error', 'telegram', 'Telegram discussion user ban failed', {
        commentId: comment.id,
        telegramUserId: comment.telegramUserId,
        error,
      });
      throw new BadGatewayException(`Telegram ban failed: ${error}`);
    }
  }

  async updateBanNote(banId: string, noteInput: unknown) {
    const note = this.parseNote(noteInput);
    const existing = await this.prisma.telegramUserBan.findUnique({ where: { id: banId } });

    if (!existing) {
      throw new NotFoundException('Telegram ban record not found');
    }

    return this.prisma.telegramUserBan.update({
      where: { id: banId },
      data: { note },
    });
  }

  private parsePageValue(
    value: string | undefined,
    fallback: number,
    minimum: number,
    maximum: number,
  ): number {
    if (value === undefined) {
      return fallback;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
      throw new BadRequestException(`Pagination value must be from ${minimum} to ${maximum}`);
    }
    return parsed;
  }

  private parseNote(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new BadRequestException('note must be a string');
    }

    const note = value.trim();
    if (note.length > MAX_NOTE_LENGTH) {
      throw new BadRequestException(`note must not exceed ${MAX_NOTE_LENGTH} characters`);
    }
    return note || null;
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return Boolean(err && typeof err === 'object' && 'code' in err && err.code === 'P2002');
  }

  private getErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
