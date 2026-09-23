import { apiFetch } from './api-client';
import type { TelegramWebhookStatus } from './api.types';

export function getTelegramWebhookStatus(): Promise<TelegramWebhookStatus> {
  return apiFetch<TelegramWebhookStatus>('/api/telegram/webhook/status');
}
