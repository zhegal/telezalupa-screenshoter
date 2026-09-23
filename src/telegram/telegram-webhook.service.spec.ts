import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramWebhookService } from './telegram-webhook.service.js';

test('accepts only the configured Telegram webhook secret', () => {
  const service = new TelegramWebhookService(
    {
      botToken: 'token',
      defaultChatId: '-1001',
      webhookUrl: '',
      webhookSecret: 'valid_secret-123',
      timeoutMs: 15_000,
    },
    {} as never,
    {} as never,
    {} as never,
  );

  assert.equal(service.isSecretValid('valid_secret-123'), true);
  assert.equal(service.isSecretValid('wrong'), false);
  assert.equal(service.isSecretValid(undefined), false);
});
