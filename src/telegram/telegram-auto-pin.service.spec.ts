import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramUpdateService } from './telegram-update.service.js';
import type { TelegramUpdate } from './telegram.types.js';

function reactionUpdate(updateId: number, reactions: number[]): TelegramUpdate {
  return {
    update_id: updateId,
    message_reaction_count: {
      chat: { id: -1001 },
      message_id: 42,
      date: 1_700_000_000,
      reactions: reactions.map((total_count, index) => ({
        type: { type: 'emoji', emoji: index === 0 ? '👍' : '🔥' },
        total_count,
      })),
    },
  };
}

test('stores the total reaction count but does not pin while automation is disabled', async () => {
  let reactionCount = 0;
  let pinCalls = 0;
  const transactionClient = {
    telegramUpdateReceipt: { create: async () => ({}) },
    telegramPublication: {
      findUnique: async () => ({
        id: 'publication-1',
        chatId: '-1001',
        messageId: 42,
        pinStatus: 'none',
      }),
      update: async ({ data }: { data: { reactionCount: number } }) => {
        reactionCount = data.reactionCount;
        return {};
      },
      updateMany: async () => ({ count: 0 }),
    },
    systemSetting: {
      findMany: async () => [
        { key: 'telegram.autoPinEnabled', value: 'false' },
        { key: 'telegram.pinReactionThreshold', value: '7' },
      ],
    },
  };
  const service = new TelegramUpdateService(
    {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(transactionClient),
      telegramUpdateReceipt: { deleteMany: async () => ({ count: 0 }) },
    } as never,
    { markUpdateReceived: () => undefined } as never,
    {
      pinChatMessage: async () => {
        pinCalls += 1;
        return true;
      },
    } as never,
    { add: () => undefined } as never,
    { ingest: async () => false } as never,
  );

  await service.process(reactionUpdate(1, [4, 6]));

  assert.equal(reactionCount, 10);
  assert.equal(pinCalls, 0);
});

test('pins once at the enabled threshold and ignores later reaction changes', async () => {
  const publication = {
    id: 'publication-1',
    chatId: '-1001',
    messageId: 42,
    pinStatus: 'none',
    reactionCount: 0,
  };
  let pinCalls = 0;
  const publicationStore = {
    findUnique: async () => ({ ...publication }),
    update: async ({ data }: { data: Record<string, unknown> }) => {
      Object.assign(publication, data);
      return { ...publication };
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const expectedStatus = where.pinStatus;
      const statusMatches =
        typeof expectedStatus === 'string'
          ? publication.pinStatus === expectedStatus
          : Array.isArray((expectedStatus as { in?: string[] } | undefined)?.in) &&
            (expectedStatus as { in: string[] }).in.includes(publication.pinStatus);

      if (!statusMatches) return { count: 0 };
      Object.assign(publication, data);
      return { count: 1 };
    },
  };
  const transactionClient = {
    telegramUpdateReceipt: { create: async () => ({}) },
    telegramPublication: publicationStore,
    systemSetting: {
      findMany: async () => [
        { key: 'telegram.autoPinEnabled', value: 'true' },
        { key: 'telegram.pinReactionThreshold', value: '7' },
      ],
    },
  };
  const service = new TelegramUpdateService(
    {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(transactionClient),
      telegramPublication: publicationStore,
      telegramUpdateReceipt: { deleteMany: async () => ({ count: 0 }) },
    } as never,
    { markUpdateReceived: () => undefined } as never,
    {
      pinChatMessage: async () => {
        pinCalls += 1;
        return true;
      },
    } as never,
    { add: () => undefined } as never,
    { ingest: async () => false } as never,
  );

  await service.process(reactionUpdate(1, [3, 4]));
  await service.process(reactionUpdate(2, [2]));

  assert.equal(publication.reactionCount, 7);
  assert.equal(publication.pinStatus, 'pinned');
  assert.equal(pinCalls, 1);
});

test('records a manual pin and deletes its Telegram service message', async () => {
  let pinData: Record<string, unknown> | null = null;
  let deletedMessage: { chatId: string; messageId: number } | null = null;
  const transactionClient = {
    telegramUpdateReceipt: { create: async () => ({}) },
    telegramPublication: {
      findUnique: async () => ({ id: 'publication-1', pinSource: null }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        pinData = data;
        return {};
      },
    },
  };
  const service = new TelegramUpdateService(
    {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(transactionClient),
      telegramUpdateReceipt: { deleteMany: async () => ({ count: 0 }) },
    } as never,
    { markUpdateReceived: () => undefined } as never,
    {
      deleteMessage: async (chatId: string, messageId: number) => {
        deletedMessage = { chatId, messageId };
        return true;
      },
    } as never,
    { add: () => undefined } as never,
    { ingest: async () => false } as never,
  );

  await service.process({
    update_id: 1,
    channel_post: {
      message_id: 90,
      date: 1_700_000_000,
      chat: { id: -1001 },
      pinned_message: {
        message_id: 42,
        date: 1_699_999_000,
        chat: { id: -1001 },
      },
    },
  });

  assert.equal(pinData?.pinStatus, 'pinned');
  assert.equal(pinData?.pinSource, 'manual');
  assert.deepEqual(deletedMessage, { chatId: '-1001', messageId: 90 });
});
