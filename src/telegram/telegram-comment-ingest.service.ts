import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { TelegramMessageUpdate } from './telegram.types.js';

const MEDIA_FIELDS = [
  'photo',
  'animation',
  'audio',
  'contact',
  'dice',
  'document',
  'game',
  'location',
  'paid_media',
  'poll',
  'sticker',
  'story',
  'video',
  'video_note',
  'venue',
  'voice',
] as const;

@Injectable()
export class TelegramCommentIngestService {
  async ingest(
    tx: Prisma.TransactionClient,
    message: TelegramMessageUpdate,
    edited: boolean,
  ): Promise<boolean> {
    if (message.is_automatic_forward || message.pinned_message) {
      return false;
    }

    const hasMedia = MEDIA_FIELDS.some((field) => message[field] !== undefined);
    if (message.text === undefined && message.caption === undefined && !hasMedia) {
      return false;
    }

    const discussionChatId = String(message.chat.id);
    const existing = await tx.telegramComment.findUnique({
      where: {
        discussionChatId_messageId: {
          discussionChatId,
          messageId: message.message_id,
        },
      },
      select: { id: true, publicationId: true },
    });
    const publicationId = existing?.publicationId ?? (await this.resolvePublicationId(tx, message));

    if (!publicationId) {
      return false;
    }

    const author = this.getAuthor(message);
    const data = {
      telegramUserId: author.telegramUserId,
      authorUsername: author.authorUsername,
      authorDisplayName: author.authorDisplayName,
      text: message.text ?? message.caption ?? null,
      hasMedia,
      telegramUrl: this.buildMessageUrl(message),
      messageEditedAt: edited ? new Date((message.edit_date ?? message.date) * 1000) : null,
    };

    await tx.telegramComment.upsert({
      where: {
        discussionChatId_messageId: {
          discussionChatId,
          messageId: message.message_id,
        },
      },
      create: {
        publicationId,
        discussionChatId,
        messageId: message.message_id,
        messageCreatedAt: new Date(message.date * 1000),
        ...data,
      },
      update: data,
    });

    return true;
  }

  private async resolvePublicationId(
    tx: Prisma.TransactionClient,
    message: TelegramMessageUpdate,
  ): Promise<string | null> {
    const discussionChatId = String(message.chat.id);
    const rootCandidates = new Set<number>();

    if (message.message_thread_id) {
      rootCandidates.add(message.message_thread_id);
    }
    if (message.reply_to_message?.message_id) {
      rootCandidates.add(message.reply_to_message.message_id);
    }

    for (const rootMessageId of rootCandidates) {
      const publication = await tx.telegramPublication.findUnique({
        where: {
          discussionChatId_discussionRootMessageId: {
            discussionChatId,
            discussionRootMessageId: rootMessageId,
          },
        },
        select: { id: true },
      });

      if (publication) {
        return publication.id;
      }
    }

    if (message.reply_to_message?.message_id) {
      const parent = await tx.telegramComment.findUnique({
        where: {
          discussionChatId_messageId: {
            discussionChatId,
            messageId: message.reply_to_message.message_id,
          },
        },
        select: { publicationId: true },
      });

      if (parent) {
        return parent.publicationId;
      }
    }

    const origin = message.reply_to_message?.forward_origin;
    if (origin?.type === 'channel' && 'chat' in origin) {
      const publication = await tx.telegramPublication.findUnique({
        where: {
          chatId_messageId: {
            chatId: String(origin.chat.id),
            messageId: origin.message_id,
          },
        },
        select: { id: true },
      });
      return publication?.id ?? null;
    }

    return null;
  }

  private getAuthor(message: TelegramMessageUpdate): {
    telegramUserId: string | null;
    authorUsername: string | null;
    authorDisplayName: string;
  } {
    if (message.from) {
      return {
        telegramUserId: String(message.from.id),
        authorUsername: message.from.username ?? null,
        authorDisplayName:
          [message.from.first_name, message.from.last_name].filter(Boolean).join(' ').trim() ||
          message.from.username ||
          String(message.from.id),
      };
    }

    return {
      telegramUserId: null,
      authorUsername: message.sender_chat?.username ?? null,
      authorDisplayName:
        message.sender_chat?.title ||
        message.sender_chat?.username ||
        `Telegram chat ${message.sender_chat?.id ?? message.chat.id}`,
    };
  }

  private buildMessageUrl(message: TelegramMessageUpdate): string {
    if (message.chat.username) {
      return `https://t.me/${message.chat.username}/${message.message_id}`;
    }

    const chatId = String(message.chat.id);
    if (chatId.startsWith('-100')) {
      return `https://t.me/c/${chatId.slice(4)}/${message.message_id}`;
    }

    return `tg://openmessage?chat_id=${encodeURIComponent(chatId)}&message_id=${message.message_id}`;
  }
}
