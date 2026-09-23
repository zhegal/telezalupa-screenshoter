export interface SendPhotoResult {
  ok: boolean;
  messageId?: number;
  chatId?: string;
  publishedAt?: Date;
  errorMessage?: string;
}

export interface TelegramApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
}

export interface TelegramMessageResult {
  message_id?: number;
  date?: number;
  chat?: TelegramChatRef;
}

export interface TelegramChatRef {
  id: number;
  type?: string;
  title?: string;
  username?: string;
}

export interface TelegramForwardOriginChannel {
  type: 'channel';
  chat: TelegramChatRef;
  message_id: number;
  date: number;
}

export interface TelegramMessageUpdate {
  message_id: number;
  date: number;
  chat: TelegramChatRef;
  is_automatic_forward?: boolean;
  forward_origin?: TelegramForwardOriginChannel | { type: string };
  forward_from_message_id?: number;
  sender_chat?: TelegramChatRef;
  pinned_message?: TelegramMessageUpdate;
}

export interface TelegramReactionCount {
  type: {
    type: string;
    emoji?: string;
    custom_emoji_id?: string;
  };
  total_count: number;
}

export interface TelegramMessageReactionCountUpdated {
  chat: TelegramChatRef;
  message_id: number;
  date: number;
  reactions: TelegramReactionCount[];
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessageUpdate;
  edited_message?: TelegramMessageUpdate;
  channel_post?: TelegramMessageUpdate;
  edited_channel_post?: TelegramMessageUpdate;
  message_reaction_count?: TelegramMessageReactionCountUpdated;
}

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
}
