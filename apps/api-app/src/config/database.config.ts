import type { ConfigService } from '@nestjs/config';

export function isProductionEnv(nodeEnv?: string): boolean {
    return nodeEnv === 'production';
}

type EnvReader = {
    get(key: string): string | undefined;
};

function createEnvReader(configService?: ConfigService): EnvReader {
    if (configService) {
        return {
            get: (key: string) => configService.get<string>(key),
        };
    }

    return {
        get: (key: string) => process.env[key],
    };
}

function getRequiredEnv(env: EnvReader, key: string): string {
    const value = env.get(key);
    if (!value) {
        throw new Error(`${key} is required`);
    }
    return value;
}

export function buildPostgresConnectionOptions(configService?: ConfigService) {
    const env = createEnvReader(configService);

    try {
        const isProduction = isProductionEnv(env.get('NODE_ENV'));

        return {
            type: 'postgres' as const,
            host: getRequiredEnv(env, 'DB_HOST'),
            port: Number(getRequiredEnv(env, 'DB_PORT')),
            username: getRequiredEnv(env, 'DB_USERNAME'),
            password: getRequiredEnv(env, 'DB_PASSWORD'),
            database: getRequiredEnv(env, 'DB_DATABASE'),
            ...(isProduction ? { ssl: { rejectUnauthorized: false } } : {}),
        };
    } catch (error) {
        throw new Error(
            `Failed to build TypeORM configuration: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}
