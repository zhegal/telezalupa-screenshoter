import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { FrameFingerprintService } from '../frames/frame-fingerprint.service.js';
import { FrameStateService } from '../frames/frame-state.service.js';
import type { SelectedChannel } from '../playlists/playlist.types.js';
import { WorkerService, type WorkerChannelOutcome } from './worker.service.js';

interface StoredFrameState {
  channelKey: string;
  channelId?: string;
  lastPublishedHash: string;
  lastPublishedAt: Date;
}

function createFrameStateService(): FrameStateService {
  const rows = new Map<string, StoredFrameState>();
  const prisma = {
    channelFrameState: {
      findUnique: async ({ where }: { where: { channelKey: string } }) => rows.get(where.channelKey) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { channelKey: string };
        create: StoredFrameState;
        update: Omit<StoredFrameState, 'channelKey'>;
      }) => {
        const row = rows.has(where.channelKey)
          ? { channelKey: where.channelKey, ...update }
          : create;
        rows.set(where.channelKey, row);
        return row;
      },
    },
  };

  return new FrameStateService(prisma as never);
}

async function frame(color: string): Promise<Buffer> {
  return sharp({
    create: {
      width: 320,
      height: 180,
      channels: 3,
      background: color,
    },
  })
    .jpeg()
    .toBuffer();
}

function selectedChannel(): SelectedChannel {
  return {
    playlistUrl: 'database:playlist-1:Test',
    channel: {
      sourceKey: 'db:channel-1',
      databaseId: 'channel-1',
      title: 'Test Channel',
      description: '',
      url: 'https://example.test/stream.m3u8',
      scale: '1280:720',
      delay: null,
      timezones: null,
      available: null,
      'user-agent': '',
    },
    currentLeft: 0,
    total: 1,
  };
}

function createWorkerHarness(initialFrame: Buffer) {
  let capturedFrame = initialFrame;
  let telegramSucceeds = true;
  let sendCount = 0;
  const frameState = createFrameStateService();
  const capture = {
    captureScreenshot: async () => capturedFrame,
  };
  const telegram = {
    sendPhoto: async () => {
      sendCount += 1;
      return telegramSucceeds
        ? { ok: true, messageId: sendCount }
        : { ok: false, errorMessage: 'send failed' };
    },
  };
  const workerState = {
    markSelected: () => undefined,
    markChannelAttempt: () => undefined,
    markError: () => undefined,
    markSuccess: () => undefined,
  };
  const logs = { add: () => undefined };
  const worker = new WorkerService(
    { intervalMs: 45_000, retryIntervalMs: 5_000, errorRetryIntervalMs: 1_000 },
    {} as never,
    {} as never,
    {} as never,
    capture as never,
    telegram as never,
    { buildCaption: () => 'caption' } as never,
    {} as never,
    workerState as never,
    logs as never,
    {} as never,
    new FrameFingerprintService(),
    frameState,
  );
  const processSelected = (
    worker as unknown as {
      processSelectedChannel(
        selected: SelectedChannel,
        source: 'database',
      ): Promise<WorkerChannelOutcome>;
    }
  ).processSelectedChannel.bind(worker);

  return {
    processSelected: () => processSelected(selectedChannel(), 'database'),
    setFrame: (value: Buffer) => {
      capturedFrame = value;
    },
    setTelegramSucceeds: (value: boolean) => {
      telegramSucceeds = value;
    },
    getSendCount: () => sendCount,
  };
}

test('filters A -> A but allows A -> B -> A', async () => {
  const frameA = await frame('#111111');
  const frameB = await frame('#eeeeee');
  const harness = createWorkerHarness(frameA);

  assert.equal(await harness.processSelected(), 'published');
  assert.equal(await harness.processSelected(), 'filtered_duplicate');
  assert.equal(harness.getSendCount(), 1);

  harness.setFrame(frameB);
  assert.equal(await harness.processSelected(), 'published');

  harness.setFrame(frameA);
  assert.equal(await harness.processSelected(), 'published');
  assert.equal(harness.getSendCount(), 3);
});

test('does not record a frame when Telegram delivery fails', async () => {
  const harness = createWorkerHarness(await frame('#123456'));
  harness.setTelegramSucceeds(false);

  assert.equal(await harness.processSelected(), 'telegram_failed');

  harness.setTelegramSucceeds(true);
  assert.equal(await harness.processSelected(), 'published');
  assert.equal(harness.getSendCount(), 2);
});

test('stops immediate duplicate advancement after the channel queue repeats', async () => {
  const duplicateFrame = await frame('#222222');
  const frameState = createFrameStateService();
  const fingerprint = new FrameFingerprintService();
  await frameState.recordPublished({
    channelKey: 'db:channel-1',
    channelId: 'channel-1',
    frameHash: await fingerprint.createHash(duplicateFrame),
  });

  let selectionCount = 0;
  let captureCount = 0;
  let sendCount = 0;
  let scheduledDelay: number | null = null;
  const worker = new WorkerService(
    { intervalMs: 45_000, retryIntervalMs: 5_000, errorRetryIntervalMs: 1_000 },
    {} as never,
    {} as never,
    {
      selectChannel: async () => {
        selectionCount += 1;
        return selectedChannel();
      },
    } as never,
    {
      captureScreenshot: async () => {
        captureCount += 1;
        return duplicateFrame;
      },
    } as never,
    {
      sendPhoto: async () => {
        sendCount += 1;
        return { ok: true, messageId: sendCount };
      },
    } as never,
    { buildCaption: () => 'caption' } as never,
    {
      schedule: (_callback: () => void, delay: number) => {
        scheduledDelay = delay;
      },
    } as never,
    {
      getStatus: () => 'running',
      setNextRun: () => undefined,
      markSelected: () => undefined,
      markChannelAttempt: () => undefined,
      markError: () => undefined,
      markSuccess: () => undefined,
    } as never,
    { add: () => undefined } as never,
    {} as never,
    fingerprint,
    frameState,
  );

  await (
    worker as unknown as { runDatabaseCycleStep(): Promise<void> }
  ).runDatabaseCycleStep();

  assert.equal(selectionCount, 2);
  assert.equal(captureCount, 1);
  assert.equal(sendCount, 0);
  assert.equal(scheduledDelay, 45_000);
});
