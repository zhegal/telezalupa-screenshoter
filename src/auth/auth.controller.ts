import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import type { LoginDto, SetupDto } from './auth.types.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get('bootstrap-status')
  getBootstrapStatus() {
    return this.authService.getBootstrapStatus();
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(body);

    response.cookie(
      this.authService.getCookieName(),
      result.sessionId,
      this.authService.getCookieOptions(),
    );

    return {
      user: result.user,
      isBootstrap: result.isBootstrap,
    };
  }

  @Post('setup')
  @HttpCode(200)
  async setup(
    @Body() body: SetupDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const currentSession = await this.authService.getSession(
      request.cookies?.[this.authService.getCookieName()],
    );
    const result = await this.authService.setupFirstUser(body, currentSession);

    response.cookie(
      this.authService.getCookieName(),
      result.sessionId,
      this.authService.getCookieOptions(),
    );

    return {
      user: result.user,
      isBootstrap: result.isBootstrap,
    };
  }

  @Get('me')
  async me(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.getSession(
      request.cookies?.[this.authService.getCookieName()],
    );

    if (!result) {
      response.clearCookie(this.authService.getCookieName(), this.authService.getClearCookieOptions());
      return {
        authenticated: false,
        user: null,
        isBootstrap: false,
      };
    }

    response.cookie(
      this.authService.getCookieName(),
      result.sessionId,
      this.authService.getCookieOptions(),
    );

    return {
      authenticated: true,
      user: result.user,
      isBootstrap: result.isBootstrap,
    };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(request.cookies?.[this.authService.getCookieName()]);
    response.clearCookie(this.authService.getCookieName(), this.authService.getClearCookieOptions());

    return {
      ok: true,
    };
  }
}
