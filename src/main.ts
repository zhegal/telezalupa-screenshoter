import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppModule } from './app.module.js';
import { APP_CONFIG } from './config/app.config.js';
import type { AppConfig } from './config/app.config.js';
import type { NextFunction, Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const appConfig = app.get<AppConfig>(APP_CONFIG);

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  configureFrontendServing(app.getHttpAdapter().getInstance());

  await app.listen(appConfig.port);
}

function configureFrontendServing(server: express.Express): void {
  const publicDir = join(__dirname, 'public');
  const indexPath = join(publicDir, 'index.html');

  if (!existsSync(indexPath)) {
    return;
  }

  server.use(express.static(publicDir));
  server.use((req: Request, res: Response, next: NextFunction) => {
    if (
      (req.method !== 'GET' && req.method !== 'HEAD') ||
      req.path.startsWith('/api') ||
      req.path.includes('.')
    ) {
      next();
      return;
    }

    res.sendFile(indexPath);
  });
}

void bootstrap();
