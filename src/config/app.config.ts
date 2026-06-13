import * as dotenv from 'dotenv';

dotenv.config();

export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  port: number;
}

export function createAppConfig(): AppConfig {
  return {
    port: Number(process.env.PORT || 3000),
  };
}
