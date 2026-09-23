import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { TelegramMessageUpdate, TelegramUpdate } from './telegram.types.js';
import { TelegramWebhookService } from './telegram-webhook.service.js';

const RECEIPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class TelegramUpdateService {
  private processedSinceCleanup = 0;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TelegramWebhookService) private readonly webhook: TelegramWebhookService,
  ) {}

  async process(
    update: TelegramUpdate,
  ): Promise<{ duplicate: boolean; linkedPublication: boolean }> {
    if (!Number.isInteger(update?.update_id)) {
      throw new BadRequestException('Telegram update_id is required');
    }

    let result: { duplicate: boolean; linkedPublication: boolean };

    try {
      result = await this.prisma.$transaction(async (tx) => {
        // Creating the receipt first makes concurrent deliveries race on the primary key. The
        // losing transaction is treated as a duplicate instead of processing the update twice.
        await tx.telegramUpdateReceipt.create({ data: { updateId: update.update_id } });

        const linkedPublication = update.message
          ? await this.linkAutomaticDiscussionForward(tx, update.message)
          : false;

        return { duplicate: false, linkedPublication };
      });
    } catch (err) {
      if (!this.isUniqueConstraintError(err)) {
        throw err;
      }

      result = { duplicate: true, linkedPublication: false };
    }

    this.webhook.markUpdateReceived();

    if (!result.duplicate) {
      this.processedSinceCleanup += 1;
      if (this.processedSinceCleanup >= 100) {
        this.processedSinceCleanup = 0;
        void this.cleanupReceipts();
      }
    }

    return result;
  }

  private async linkAutomaticDiscussionForward(
    tx: Prisma.TransactionClient,
    message: TelegramMessageUpdate,
  ): Promise<boolean> {
    if (!message.is_automatic_forward) {
      return false;
    }

    const origin = this.getChannelOrigin(message);

    if (!origin) {
      return false;
    }

    const publication = await tx.telegramPublication.findUnique({
      where: {
        chatId_messageId: {
          chatId: origin.chatId,
          messageId: origin.messageId,
        },
      },
      select: { id: true },
    });

    if (!publication) {
      return false;
    }

    await tx.telegramPublication.update({
      where: { id: publication.id },
      data: {
        discussionChatId: String(message.chat.id),
        discussionRootMessageId: message.message_id,
      },
    });
    return true;
  }

  private getChannelOrigin(
    message: TelegramMessageUpdate,
  ): { chatId: string; messageId: number } | null {
    if (message.forward_origin?.type === 'channel' && 'chat' in message.forward_origin) {
      return {
        chatId: String(message.forward_origin.chat.id),
        messageId: message.forward_origin.message_id,
      };
    }

    if (message.sender_chat && message.forward_from_message_id) {
      return {
        chatId: String(message.sender_chat.id),
        messageId: message.forward_from_message_id,
      };
    }

    return null;
  }

  private async cleanupReceipts(): Promise<void> {
    const createdBefore = new Date(Date.now() - RECEIPT_RETENTION_MS);
    await this.prisma.telegramUpdateReceipt
      .deleteMany({ where: { createdAt: { lt: createdBefore } } })
      .catch(() => undefined);
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return Boolean(err && typeof err === 'object' && 'code' in err && err.code === 'P2002');
  }
}
