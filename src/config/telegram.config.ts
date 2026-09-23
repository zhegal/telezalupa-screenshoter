export const TELEGRAM_CONFIG = Symbol('TELEGRAM_CONFIG');

export interface TelegramConfig {
  botToken: string;
  defaultChatId: string;
  webhookUrl: string;
  webhookSecret: string;
  timeoutMs: number;
}

export function createTelegramConfig(): TelegramConfig {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    defaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID || '',
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    timeoutMs: 15000,
  };
}
