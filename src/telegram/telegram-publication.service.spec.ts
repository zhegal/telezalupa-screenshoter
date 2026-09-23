import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramPublicationService } from './telegram-publication.service.js';

test('persists publication and frame state in one transaction', async () => {
  const writes: string[] = [];
  const prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        telegramPublication: {
          upsert: async () => {
            writes.push('publication');
            return { id: 'publication-1' };
          },
        },
        channelFrameState: {
          upsert: async () => {
            writes.push('frame-state');
            return { id: 'state-1' };
          },
        },
      }),
  };
  const remembered: Array<{ channelKey: string; frameHash: string }> = [];
  const service = new TelegramPublicationService(
    prisma as never,
    {
      rememberPublished: (channelKey: string, frameHash: string) => {
        remembered.push({ channelKey, frameHash });
      },
    } as never,
  );

  const result = await service.record({
    channelKey: 'db:channel-1',
    channelId: 'channel-1',
    channelTitle: 'Channel',
    chatId: '-1001',
    messageId: 42,
    frameHash: 'hash-a',
  });

  assert.deepEqual(writes, ['publication', 'frame-state']);
  assert.deepEqual(remembered, [{ channelKey: 'db:channel-1', frameHash: 'hash-a' }]);
  assert.deepEqual(result, { id: 'publication-1' });
});
