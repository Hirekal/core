import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudStorageModule } from './modules/cloud-storage/cloud-storage.module';
import { getDatabaseUrl } from './config/typeorm.config';
import { JobModule } from './modules/job/job.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres' as const,
                url: getDatabaseUrl(configService),
                autoLoadEntities: true,
                synchronize: false,
                migrations: ['dist/apps/api-app/src/migrations/*.js'],
                migrationsRun: false,
            }),
        }),
        CloudStorageModule,
        JobModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule { }
