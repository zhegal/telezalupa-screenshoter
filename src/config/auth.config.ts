export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export interface AuthConfig {
  tempAdminPassword: string;
  sessionCookieName: string;
  sessionTtlMs: number;
  isProduction: boolean;
}

export function createAuthConfig(): AuthConfig {
  return {
    tempAdminPassword: process.env.TEMP_ADMIN_PASSWORD || '',
    sessionCookieName: 'screenshoter_session',
    sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
    isProduction: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
  };
}
