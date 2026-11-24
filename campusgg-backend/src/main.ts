import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const production = config.get<string>('NODE_ENV') === 'production';
  const configured = config.get<string>('FRONTEND_BASE_URL')?.trim();
  if (production && !configured) {
    throw new Error('FRONTEND_BASE_URL is required in production');
  }
  const frontend = new URL(configured || 'http://localhost:5173');
  if (
    !['http:', 'https:'].includes(frontend.protocol) ||
    (production && frontend.protocol !== 'https:') ||
    frontend.username ||
    frontend.password
  ) {
    throw new Error(
      'FRONTEND_BASE_URL must be an HTTP(S) URL (HTTPS in production)',
    );
  }
  const origins = production
    ? [frontend.origin]
    : [
        ...new Set([
          frontend.origin,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
        ]),
      ];
  if (production && config.get<string>('TRUST_LOCAL_PROXY') === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');
  }
  app.enableCors({ origin: origins });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = Number(config.get<string>('PORT') ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }
  await app.listen(port);
  console.log(`CampusGG backend running on port ${port}`);
}
void bootstrap();
