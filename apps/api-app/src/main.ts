import { ValidationPipe } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import { json, raw, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HTTP_HEADERS } from './modules/auth/common/constants/app.constants';
import { CronService } from './modules/cron/cron.service';

const PAYMENTS_WEBHOOK_PATH = '/api/v1/payments/webhooks';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.use((req: RawBodyRequest<Request>, res: Response, next: NextFunction) => {
    if (req.originalUrl.startsWith(PAYMENTS_WEBHOOK_PATH)) {
      return raw({ type: 'application/json' })(req, res, next);
    }

    return json({
      limit: '5mb',
      verify: (request: RawBodyRequest<Request>, _response, buffer) => {
        if (Buffer.isBuffer(buffer)) {
          request.rawBody = buffer;
        }
      },
    })(req, res, next);
  });
  app.use(urlencoded({ extended: true, limit: '5mb' }));

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
