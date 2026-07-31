/**
 * @fileoverview TypeORM CLI DataSource (migration:run / revert / show).
 * Nest runtime wiring lives in app.module.ts — do not import this file from Nest.
 */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { buildPostgresConnectionOptions } from './database.config';

loadEnv({ path: resolve(__dirname, '../../.env') });

export default new DataSource({
    ...buildPostgresConnectionOptions(),
    // Paths relative to apps/api-app (npm workspace cwd for migration scripts)
    entities: ['src/modules/**/*.entity{.ts,.js}'],
    migrations: ['src/migrations/*{.ts,.js}'],
    synchronize: false,
});
