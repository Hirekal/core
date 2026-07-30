import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// TypeORM CLI runs outside Nest DI — load .env then read via ConfigService
loadEnv();

/**
 * Resolve DATABASE_URL via ConfigService (required — no hardcoded default).
 */
export function getDatabaseUrl(configService: ConfigService): string {
    const url = configService.get<string>('DATABASE_URL');
    if (!url) {
        throw new Error('DATABASE_URL is required');
    }
    return url;
}

/**
 * Shared Postgres TypeORM options for the TypeORM CLI.
 */
export function buildTypeOrmDataSourceOptions(
    configService: ConfigService,
): DataSourceOptions {
    return {
        type: 'postgres',
        url: getDatabaseUrl(configService),
        entities: ['src/modules/**/*.entity.ts'],
        migrations: ['src/migrations/*.ts'],
        synchronize: false,
    };
}

const configService = new ConfigService();

export default new DataSource(buildTypeOrmDataSourceOptions(configService));
