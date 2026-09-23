import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { TelegramSettingsService } from './telegram-settings.service.js';

test('uses disabled automation and threshold 7 when settings are absent', async () => {
  const service = new TelegramSettingsService({
    systemSetting: { findMany: async () => [] },
  } as never);

  assert.deepEqual(await service.get(), {
    autoPinEnabled: false,
    reactionThreshold: 7,
  });
});

test('rejects a reaction threshold below one', async () => {
  const service = new TelegramSettingsService({} as never);

  await assert.rejects(
    () => service.update({ autoPinEnabled: true, reactionThreshold: 0 }),
    BadRequestException,
  );
});
