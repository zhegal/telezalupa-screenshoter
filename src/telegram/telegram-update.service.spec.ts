import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramUpdateService } from './telegram-update.service.js';
import type { TelegramUpdate } from './telegram.types.js';

test('links an automatic discussion forward and ignores repeated delivery', async () => {
  const receipts = new Set<number>();
  let linkedData: Record<string, unknown> | null = null;
  let receivedMarks = 0;
  const transactionClient = {
    telegramUpdateReceipt: {
      create: async ({ data }: { data: { updateId: number } }) => {
        if (receipts.has(data.updateId)) {
          throw { code: 'P2002' };
        }
        receipts.add(data.updateId);
        return data;
      },
    },
    telegramPublication: {
      findUnique: async () => ({ id: 'publication-1' }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        linkedData = data;
        return { id: 'publication-1' };
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(transactionClient),
    telegramUpdateReceipt: {
      deleteMany: async () => ({ count: 0 }),
    },
  };
  const service = new TelegramUpdateService(
    prisma as never,
    {
      markUpdateReceived: () => {
        receivedMarks += 1;
      },
    } as never,
  );
  const update: TelegramUpdate = {
    update_id: 100,
    message: {
      message_id: 77,
      date: 1_700_000_000,
      chat: { id: -2002 },
      is_automatic_forward: true,
      forward_origin: {
        type: 'channel',
        chat: { id: -1001 },
        message_id: 42,
        date: 1_700_000_000,
      },
    },
  };

  assert.deepEqual(await service.process(update), {
    duplicate: false,
    linkedPublication: true,
  });
  assert.deepEqual(linkedData, {
    discussionChatId: '-2002',
    discussionRootMessageId: 77,
  });
  assert.deepEqual(await service.process(update), {
    duplicate: true,
    linkedPublication: false,
  });
  assert.equal(receipts.size, 1);
  assert.equal(receivedMarks, 2);
});
