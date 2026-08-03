/**
 * @fileoverview TypeORM CLI DataSource (migration:run / revert / show).
 * Nest runtime wiring lives in app.module.ts — do not import this file from Nest.
 */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';

loadEnv({ path: resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  // Paths relative to apps/api-app (npm workspace cwd for migration scripts)
  entities: ['src/modules/**/*.entity{.ts,.js}'],
  migrations: ['src/migrations/*{.ts,.js}'],
  synchronize: false,
});
