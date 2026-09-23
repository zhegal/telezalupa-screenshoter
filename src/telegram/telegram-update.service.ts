import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RuntimeLogService } from '../logs/runtime-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_TELEGRAM_PIN_REACTION_THRESHOLD,
  TELEGRAM_AUTO_PIN_ENABLED_KEY,
  TELEGRAM_PIN_REACTION_THRESHOLD_KEY,
} from './telegram-settings.service.js';
import { TelegramCommentIngestService } from './telegram-comment-ingest.service.js';
import { TelegramService } from './telegram.service.js';
import type {
  TelegramMessageReactionCountUpdated,
  TelegramMessageUpdate,
  TelegramUpdate,
} from './telegram.types.js';
import { TelegramWebhookService } from './telegram-webhook.service.js';

const RECEIPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

interface PinRequest {
  publicationId: string;
  chatId: string;
  messageId: number;
}

interface DeleteServiceMessageRequest {
  chatId: string;
  messageId: number;
}

interface UpdateTransactionResult {
  linkedPublication: boolean;
  pinRequest: PinRequest | null;
  serviceMessage: DeleteServiceMessageRequest | null;
}

@Injectable()
export class TelegramUpdateService {
  private processedSinceCleanup = 0;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TelegramWebhookService) private readonly webhook: TelegramWebhookService,
    @Inject(TelegramService) private readonly telegram: TelegramService,
    @Inject(RuntimeLogService) private readonly logs: RuntimeLogService,
    @Inject(TelegramCommentIngestService)
    private readonly comments: TelegramCommentIngestService,
  ) {}

  async process(
    update: TelegramUpdate,
  ): Promise<{ duplicate: boolean; linkedPublication: boolean }> {
    if (!Number.isInteger(update?.update_id)) {
      throw new BadRequestException('Telegram update_id is required');
    }

    let transactionResult: UpdateTransactionResult;

    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
        // Creating the receipt first makes concurrent deliveries race on the primary key. The
        // losing transaction is treated as a duplicate instead of processing the update twice.
        await tx.telegramUpdateReceipt.create({ data: { updateId: update.update_id } });
        return this.processTransaction(tx, update);
      });
    } catch (err) {
      if (!this.isUniqueConstraintError(err)) {
        throw err;
      }

      this.webhook.markUpdateReceived();
      return { duplicate: true, linkedPublication: false };
    }

    this.webhook.markUpdateReceived();
    await this.runTelegramEffects(transactionResult);

    this.processedSinceCleanup += 1;
    if (this.processedSinceCleanup >= 100) {
      this.processedSinceCleanup = 0;
      void this.cleanupReceipts();
    }

    return {
      duplicate: false,
      linkedPublication: transactionResult.linkedPublication,
    };
  }

  private async processTransaction(
    tx: Prisma.TransactionClient,
    update: TelegramUpdate,
  ): Promise<UpdateTransactionResult> {
    const linkedPublication = update.message
      ? await this.linkAutomaticDiscussionForward(tx, update.message)
      : false;
    const serviceMessage = await this.recordPinServiceMessage(
      tx,
      update.message ?? update.channel_post,
    );
    const pinRequest = update.message_reaction_count
      ? await this.recordReactionCount(tx, update.message_reaction_count)
      : null;

    if (update.message) {
      await this.comments.ingest(tx, update.message, false);
    }
    if (update.edited_message) {
      await this.comments.ingest(tx, update.edited_message, true);
    }

    return { linkedPublication, pinRequest, serviceMessage };
  }

  private async recordReactionCount(
    tx: Prisma.TransactionClient,
    reactionUpdate: TelegramMessageReactionCountUpdated,
  ): Promise<PinRequest | null> {
    const publication = await tx.telegramPublication.findUnique({
      where: {
        chatId_messageId: {
          chatId: String(reactionUpdate.chat.id),
          messageId: reactionUpdate.message_id,
        },
      },
      select: { id: true, chatId: true, messageId: true, pinStatus: true },
    });

    if (!publication || publication.pinStatus === 'pinned') {
      return null;
    }

    const reactionCount = this.sumReactionCounts(reactionUpdate);
    await tx.telegramPublication.update({
      where: { id: publication.id },
      data: { reactionCount },
    });

    const settings = await this.readAutoPinSettings(tx);
    if (!settings.enabled || reactionCount < settings.threshold) {
      return null;
    }

    const claim = await tx.telegramPublication.updateMany({
      where: {
        id: publication.id,
        pinStatus: { in: ['none', 'error'] },
      },
      data: {
        pinStatus: 'pending',
        pinSource: 'automatic',
        pinError: null,
      },
    });

    return claim.count === 1
      ? {
          publicationId: publication.id,
          chatId: publication.chatId,
          messageId: publication.messageId,
        }
      : null;
  }

  private async recordPinServiceMessage(
    tx: Prisma.TransactionClient,
    message?: TelegramMessageUpdate,
  ): Promise<DeleteServiceMessageRequest | null> {
    if (!message?.pinned_message) {
      return null;
    }

    const chatId = String(message.chat.id);
    const pinnedMessageId = message.pinned_message.message_id;
    const directPublication = await tx.telegramPublication.findUnique({
      where: {
        chatId_messageId: {
          chatId,
          messageId: pinnedMessageId,
        },
      },
      select: { id: true, pinStatus: true, pinSource: true },
    });
    const publication =
      directPublication ??
      (await tx.telegramPublication.findUnique({
        where: {
          discussionChatId_discussionRootMessageId: {
            discussionChatId: chatId,
            discussionRootMessageId: pinnedMessageId,
          },
        },
        select: { id: true, pinStatus: true, pinSource: true },
      }));

    if (publication && publication.pinStatus !== 'pinned') {
      const source =
        publication.pinStatus === 'pending' && publication.pinSource === 'automatic'
          ? 'automatic'
          : 'manual';

      await tx.telegramPublication.update({
        where: { id: publication.id },
        data: {
          pinStatus: 'pinned',
          pinSource: source,
          pinError: null,
          pinnedAt: new Date(message.date * 1000),
        },
      });
    }

    // Telegram creates this visual-only service message for both manual and Bot API pins.
    return { chatId, messageId: message.message_id };
  }

  private async runTelegramEffects(result: UpdateTransactionResult): Promise<void> {
    if (result.pinRequest) {
      await this.pinPublication(result.pinRequest);
    }

    if (result.serviceMessage) {
      await this.deletePinServiceMessage(result.serviceMessage);
    }
  }

  private async pinPublication(request: PinRequest): Promise<void> {
    try {
      const pinned = await this.telegram.pinChatMessage(request.chatId, request.messageId);
      if (!pinned) {
        throw new Error('Telegram did not confirm pinChatMessage');
      }

      await this.prisma.telegramPublication.updateMany({
        where: { id: request.publicationId, pinStatus: 'pending' },
        data: {
          pinStatus: 'pinned',
          pinSource: 'automatic',
          pinError: null,
          pinnedAt: new Date(),
        },
      });
      this.logs.add('info', 'telegram', 'Telegram publication pinned automatically', {
        publicationId: request.publicationId,
        messageId: request.messageId,
      });
    } catch (err) {
      const error = this.getErrorMessage(err);
      await this.prisma.telegramPublication.updateMany({
        where: { id: request.publicationId, pinStatus: 'pending' },
        data: { pinStatus: 'error', pinError: error },
      });
      this.logs.add('error', 'telegram', 'Automatic Telegram pin failed', {
        publicationId: request.publicationId,
        messageId: request.messageId,
        error,
      });
    }
  }

  private async deletePinServiceMessage(request: DeleteServiceMessageRequest): Promise<void> {
    try {
      await this.telegram.deleteMessage(request.chatId, request.messageId);
    } catch (err) {
      this.logs.add('error', 'telegram', 'Telegram pin service message deletion failed', {
        messageId: request.messageId,
        error: this.getErrorMessage(err),
      });
    }
  }

  private async readAutoPinSettings(
    tx: Prisma.TransactionClient,
  ): Promise<{ enabled: boolean; threshold: number }> {
    const rows = await tx.systemSetting.findMany({
      where: {
        key: { in: [TELEGRAM_AUTO_PIN_ENABLED_KEY, TELEGRAM_PIN_REACTION_THRESHOLD_KEY] },
      },
    });
    const settings = new Map(rows.map((row) => [row.key, row.value]));
    const parsedThreshold = Number(settings.get(TELEGRAM_PIN_REACTION_THRESHOLD_KEY));

    return {
      enabled: settings.get(TELEGRAM_AUTO_PIN_ENABLED_KEY) === 'true',
      threshold:
        Number.isInteger(parsedThreshold) && parsedThreshold >= 1
          ? parsedThreshold
          : DEFAULT_TELEGRAM_PIN_REACTION_THRESHOLD,
    };
  }

  private sumReactionCounts(update: TelegramMessageReactionCountUpdated): number {
    if (!Array.isArray(update.reactions)) {
      return 0;
    }

    return Math.min(
      POSTGRES_INTEGER_MAX,
      update.reactions.reduce((sum, reaction) => {
        const count = reaction?.total_count;
        return Number.isInteger(count) && count > 0 ? sum + count : sum;
      }, 0),
    );
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

  private getErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
