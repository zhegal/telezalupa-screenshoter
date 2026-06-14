export interface SendPhotoResult {
  ok: boolean;
  messageId?: number;
  errorMessage?: string;
}

export interface TelegramApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
}

export interface TelegramMessageResult {
  message_id?: number;
}
