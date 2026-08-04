import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HTTP_HEADERS } from './modules/auth/common/constants/app.constants';
import { CronService } from './modules/cron/cron.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin) {
    throw new Error('CORS_ORIGIN is required');
  }

  app.enableCors({
    origin: corsOrigin,
    exposedHeaders: [
      HTTP_HEADERS.AUTHORIZATION,
      HTTP_HEADERS.REFRESH_TOKEN,
      HTTP_HEADERS.ACCESS_TOKEN_EXPIRES_AT,
      HTTP_HEADERS.REFRESH_TOKEN_EXPIRES_AT,
    ],
  });

  // Cron jobs are registered during init; gate them before listen (no setTimeout).
  await app.init();
  app.get(CronService).applyCronServerGate();

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
