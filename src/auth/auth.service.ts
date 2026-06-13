import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import prismaClient from '@prisma/client';
import { AUTH_CONFIG, type AuthConfig } from '../config/auth.config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthSessionPayload, LoginDto, SetupDto } from './auth.types.js';
import { toPublicUser } from './auth.types.js';

const { UserRole } = prismaClient;

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_CONFIG) private readonly authConfig: AuthConfig,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getBootstrapStatus() {
    const userCount = await this.prisma.user.count();
    const hasUsers = userCount > 0;
    const tempAdminPasswordConfigured = this.authConfig.tempAdminPassword.length > 0;

    return {
      hasUsers,
      tempAdminPasswordConfigured,
      bootstrapAvailable: !hasUsers && tempAdminPasswordConfigured,
    };
  }

  async login(dto: LoginDto): Promise<AuthSessionPayload> {
    const login = this.normalizeRequired(dto.login, 'login');
    const password = this.normalizeRequired(dto.password, 'password');
    const status = await this.getBootstrapStatus();

    if (!status.hasUsers) {
      if (!status.tempAdminPasswordConfigured) {
        throw new UnauthorizedException('TEMP_ADMIN_PASSWORD is not configured');
      }

      if (login !== 'admin' || password !== this.authConfig.tempAdminPassword) {
        throw new UnauthorizedException('Invalid login or password');
      }

      const session = await this.createSession(null, true);

      return {
        sessionId: session.id,
        user: null,
        isBootstrap: true,
      };
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: login }, { username: login }],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid login or password');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid login or password');
    }

    const session = await this.createSession(user.id, false);

    return {
      sessionId: session.id,
      user: toPublicUser(user),
      isBootstrap: false,
    };
  }

  async getSession(sessionId?: string): Promise<AuthSessionPayload | null> {
    if (!sessionId) {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      }

      return null;
    }

    if (session.isBootstrap && (await this.prisma.user.count()) > 0) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }

    const expiresAt = this.getNextExpiresAt();
    const updatedSession = await this.prisma.session.update({
      where: { id: session.id },
      data: { expiresAt },
      include: { user: true },
    });

    return {
      sessionId: updatedSession.id,
      user: updatedSession.user ? toPublicUser(updatedSession.user) : null,
      isBootstrap: updatedSession.isBootstrap,
    };
  }

  async setupFirstUser(dto: SetupDto, currentSession: AuthSessionPayload | null): Promise<AuthSessionPayload> {
    const status = await this.getBootstrapStatus();

    if (status.hasUsers || !currentSession?.isBootstrap) {
      throw new UnauthorizedException('Setup is not available');
    }

    const email = this.normalizeRequired(dto.email, 'email').toLowerCase();
    const username = this.normalizeRequired(dto.username, 'username');
    const password = this.normalizeRequired(dto.password, 'password');
    const displayName = this.normalizeOptional(dto.displayName);
    const telegramId = this.normalizeOptional(dto.telegramId);

    if (!this.isValidEmail(email)) {
      throw new BadRequestException('Invalid email');
    }

    if (username.length < 3) {
      throw new BadRequestException('Username must be at least 3 characters');
    }

    if (password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const userCount = await tx.user.count();

      if (userCount > 0) {
        throw new UnauthorizedException('Setup is not available');
      }

      await tx.session.delete({ where: { id: currentSession.sessionId } }).catch(() => undefined);

      return tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          displayName,
          telegramId,
          role: UserRole.admin,
        },
      });
    });

    const session = await this.createSession(user.id, false);

    return {
      sessionId: session.id,
      user: toPublicUser(user),
      isBootstrap: false,
    };
  }

  async logout(sessionId?: string): Promise<void> {
    if (!sessionId) {
      return;
    }

    await this.prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
  }

  getCookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.authConfig.isProduction,
      maxAge: this.authConfig.sessionTtlMs,
      path: '/',
    };
  }

  getClearCookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.authConfig.isProduction,
      path: '/',
    };
  }

  getCookieName(): string {
    return this.authConfig.sessionCookieName;
  }

  private async createSession(userId: string | null, isBootstrap: boolean) {
    return this.prisma.session.create({
      data: {
        id: randomBytes(32).toString('hex'),
        userId,
        isBootstrap,
        expiresAt: this.getNextExpiresAt(),
      },
    });
  }

  private getNextExpiresAt(): Date {
    return new Date(Date.now() + this.authConfig.sessionTtlMs);
  }

  private normalizeRequired(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required`);
    }

    return value.trim();
  }

  private normalizeOptional(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : undefined;
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
