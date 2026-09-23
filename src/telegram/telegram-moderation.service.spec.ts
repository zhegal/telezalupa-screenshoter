import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { TelegramModerationService } from './telegram-moderation.service.js';

test('bans a comment author and preserves the supplied private note', async () => {
  const comment = {
    id: 'comment-1',
    publicationId: 'publication-1',
    discussionChatId: '-1002002',
    telegramUserId: '123',
    authorUsername: 'test_user',
    authorDisplayName: 'Test User',
    ban: null,
  };
  let ban = {
    id: 'ban-1',
    commentId: comment.id,
    status: 'pending',
    note: 'spam',
  } as Record<string, unknown>;
  let telegramCall: { chatId: string; userId: string } | null = null;
  const service = new TelegramModerationService(
    {
      telegramComment: { findUnique: async () => comment },
      telegramUserBan: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          ban = { ...ban, ...data };
          return ban;
        },
        update: async ({ data }: { data: Record<string, unknown> }) => {
          ban = { ...ban, ...data };
          return ban;
        },
      },
    } as never,
    {
      banChatMember: async (chatId: string, userId: string) => {
        telegramCall = { chatId, userId };
        return true;
      },
    } as never,
    { add: () => undefined } as never,
  );

  const result = await service.banCommentAuthor(comment.id, ' spam ');

  assert.deepEqual(telegramCall, { chatId: '-1002002', userId: '123' });
  assert.equal(result.status, 'completed');
  assert.equal(result.note, 'spam');
  assert.ok(result.bannedAt instanceof Date);
});

test('refuses to ban a sender-chat comment without a Telegram user ID', async () => {
  const service = new TelegramModerationService(
    {
      telegramComment: {
        findUnique: async () => ({ id: 'comment-1', telegramUserId: null }),
      },
    } as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(() => service.banCommentAuthor('comment-1', ''), BadRequestException);
});
