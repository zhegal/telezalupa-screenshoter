import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramCommentIngestService } from './telegram-comment-ingest.service.js';

test('stores comment identity, text, media flag, link, and publication relation', async () => {
  let created: Record<string, unknown> | null = null;
  const service = new TelegramCommentIngestService();
  const tx = {
    telegramComment: {
      findUnique: async () => null,
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        created = create;
        return create;
      },
    },
    telegramPublication: {
      findUnique: async () => ({ id: 'publication-1' }),
    },
  };

  const stored = await service.ingest(
    tx as never,
    {
      message_id: 88,
      date: 1_700_000_000,
      chat: { id: -1002002 },
      from: {
        id: 123,
        first_name: 'Test',
        last_name: 'User',
        username: 'test_user',
      },
      text: 'Comment text',
      photo: [{ file_id: 'not-downloaded' }],
      reply_to_message: {
        message_id: 77,
        date: 1_699_999_000,
        chat: { id: -1002002 },
      },
    },
    false,
  );

  assert.equal(stored, true);
  assert.equal(created?.publicationId, 'publication-1');
  assert.equal(created?.telegramUserId, '123');
  assert.equal(created?.authorUsername, 'test_user');
  assert.equal(created?.authorDisplayName, 'Test User');
  assert.equal(created?.text, 'Comment text');
  assert.equal(created?.hasMedia, true);
  assert.equal(created?.telegramUrl, 'https://t.me/c/2002/88');
});

test('updates an edited comment without needing to resolve its publication again', async () => {
  let updated: Record<string, unknown> | null = null;
  let publicationLookups = 0;
  const service = new TelegramCommentIngestService();
  const tx = {
    telegramComment: {
      findUnique: async () => ({ id: 'comment-1', publicationId: 'publication-1' }),
      upsert: async ({ update }: { update: Record<string, unknown> }) => {
        updated = update;
        return update;
      },
    },
    telegramPublication: {
      findUnique: async () => {
        publicationLookups += 1;
        return null;
      },
    },
  };

  await service.ingest(
    tx as never,
    {
      message_id: 88,
      date: 1_700_000_000,
      edit_date: 1_700_000_100,
      chat: { id: -1002002, username: 'discussion' },
      from: { id: 123, first_name: 'Test' },
      text: 'Edited text',
    },
    true,
  );

  assert.equal(publicationLookups, 0);
  assert.equal(updated?.text, 'Edited text');
  assert.deepEqual(updated?.messageEditedAt, new Date(1_700_000_100 * 1000));
  assert.equal(updated?.telegramUrl, 'https://t.me/discussion/88');
});

test('links a nested reply through its already stored parent comment', async () => {
  const service = new TelegramCommentIngestService();
  let createdPublicationId: unknown;
  const tx = {
    telegramComment: {
      findUnique: async ({
        where,
      }: {
        where: { discussionChatId_messageId: { messageId: number } };
      }) =>
        where.discussionChatId_messageId.messageId === 87
          ? { publicationId: 'publication-1' }
          : null,
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        createdPublicationId = create.publicationId;
        return create;
      },
    },
    telegramPublication: { findUnique: async () => null },
  };

  await service.ingest(
    tx as never,
    {
      message_id: 88,
      date: 1_700_000_000,
      chat: { id: -1002002 },
      from: { id: 124, first_name: 'Nested' },
      text: 'Nested reply',
      reply_to_message: {
        message_id: 87,
        date: 1_699_999_900,
        chat: { id: -1002002 },
      },
    },
    false,
  );

  assert.equal(createdPublicationId, 'publication-1');
});
