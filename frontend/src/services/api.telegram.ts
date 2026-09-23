import { apiFetch } from './api-client';
import type { TelegramAutomationSettings, TelegramWebhookStatus } from './api.types';

export function getTelegramWebhookStatus(): Promise<TelegramWebhookStatus> {
  return apiFetch<TelegramWebhookStatus>('/api/telegram/webhook/status');
}

export function getTelegramAutomationSettings(): Promise<TelegramAutomationSettings> {
  return apiFetch<TelegramAutomationSettings>('/api/telegram/settings');
}

export function updateTelegramAutomationSettings(
  settings: TelegramAutomationSettings,
): Promise<TelegramAutomationSettings> {
  return apiFetch<TelegramAutomationSettings>('/api/telegram/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
}
