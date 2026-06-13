import type { User, UserRole } from '@prisma/client';

export interface LoginDto {
  login?: string;
  password?: string;
}

export interface SetupDto {
  email?: string;
  username?: string;
  password?: string;
  displayName?: string;
  telegramId?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: UserRole;
  telegramId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionPayload {
  sessionId: string;
  user: PublicUser | null;
  isBootstrap: boolean;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    telegramId: user.telegramId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
