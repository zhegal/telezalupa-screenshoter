export const TELEGRAM_CONFIG = Symbol('TELEGRAM_CONFIG');

export interface TelegramConfig {
  botToken: string;
  defaultChatId: string;
  timeoutMs: number;
}

export function createTelegramConfig(): TelegramConfig {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    defaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID || '',
    timeoutMs: 15000,
  };
}
