import { apiFetch } from './api-client';
import type {
  TelegramAutomationSettings,
  TelegramCommentListResponse,
  TelegramUserBan,
  TelegramWebhookStatus,
} from './api.types';

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

export function getTelegramComments(input: {
  limit: number;
  offset: number;
}): Promise<TelegramCommentListResponse> {
  const params = new URLSearchParams({
    limit: String(input.limit),
    offset: String(input.offset),
  });
  return apiFetch<TelegramCommentListResponse>(`/api/telegram/comments?${params}`);
}

export function banTelegramCommentAuthor(
  commentId: string,
  note: string,
): Promise<TelegramUserBan> {
  return apiFetch<TelegramUserBan>(`/api/telegram/comments/${commentId}/ban`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export function updateTelegramBanNote(banId: string, note: string): Promise<TelegramUserBan> {
  return apiFetch<TelegramUserBan>(`/api/telegram/bans/${banId}`, {
    method: 'PATCH',
    body: JSON.stringify({ note }),
  });
}
