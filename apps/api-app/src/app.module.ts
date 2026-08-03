import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join, resolve } from 'path';
import { buildPostgresConnectionOptions } from './config/database.config';
import { CloudStorageModule } from './modules/cloud-storage/cloud-storage.module';
import { ApplicationModule } from './modules/application/application.module';
import { JobModule } from './modules/job/job.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Works from monorepo root (nest start) and from apps/api-app cwd
      envFilePath: [
        resolve(process.cwd(), 'apps/api-app/.env'),
        resolve(process.cwd(), '.env'),
        resolve(__dirname, '../.env'),
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...buildPostgresConnectionOptions(configService),
        synchronize: false,
        migrationsRun: false,
        entities: [join(__dirname, 'modules/**/entities/*.entity{.ts,.js}')],
        migrations: [join(__dirname, 'migrations/*{.js,.ts}')],
      }),
    }),
    CloudStorageModule,
    JobModule,
    ApplicationModule,
    NotificationsModule,
    AuthModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        jwtSecret: configService.getOrThrow<string>('JWT_SECRET'),
        jwtAccessExpiresIn: configService.get('JWT_ACCESS_EXPIRES_IN'),
        jwtRefreshExpiresIn: configService.get('JWT_REFRESH_EXPIRES_IN'),
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
