import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

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
    });
    await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
