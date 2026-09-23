import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { FrameStateService } from '../frames/frame-state.service.js';

export interface RecordTelegramPublicationInput {
  channelKey: string;
  channelId?: string;
  channelTitle: string;
  chatId: string;
  messageId: number;
  frameHash: string;
  publishedAt?: Date;
}

@Injectable()
export class TelegramPublicationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FrameStateService) private readonly frameState: FrameStateService,
  ) {}

  async record(input: RecordTelegramPublicationInput) {
    const publishedAt = input.publishedAt ?? new Date();
    this.frameState.rememberPublished(input.channelKey, input.frameHash);

    return this.prisma.$transaction(async (tx) => {
      const publication = await tx.telegramPublication.upsert({
        where: {
          chatId_messageId: {
            chatId: input.chatId,
            messageId: input.messageId,
          },
        },
        create: {
          channelKey: input.channelKey,
          channelId: input.channelId,
          channelTitle: input.channelTitle,
          chatId: input.chatId,
          messageId: input.messageId,
          frameHash: input.frameHash,
          publishedAt,
        },
        update: {
          channelKey: input.channelKey,
          channelId: input.channelId,
          channelTitle: input.channelTitle,
          frameHash: input.frameHash,
        },
      });

      await tx.channelFrameState.upsert({
        where: { channelKey: input.channelKey },
        create: {
          channelKey: input.channelKey,
          channelId: input.channelId,
          lastPublishedHash: input.frameHash,
          lastPublishedAt: publishedAt,
        },
        update: {
          channelId: input.channelId,
          lastPublishedHash: input.frameHash,
          lastPublishedAt: publishedAt,
        },
      });

      return publication;
    });
  }
}
