import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'path';
import { CloudStorageModule } from './modules/cloud-storage/cloud-storage.module';
import { ApplicationModule } from './modules/application/application.module';
import { JobModule } from './modules/job/job.module';
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
            useFactory: (configService: ConfigService) => {
                const url = configService.get<string>('DATABASE_URL');
                if (!url) {
                    throw new Error('DATABASE_URL is required');
                }
                return {
                    type: 'postgres' as const,
                    url,
                    autoLoadEntities: true,
                    synchronize: false,
                    migrationsRun: false,
                };
            },
        }),
        CloudStorageModule,
        JobModule,
        ApplicationModule,
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
export class AppModule { }
