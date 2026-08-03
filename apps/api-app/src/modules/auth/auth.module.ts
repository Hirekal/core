import {
  DynamicModule,
  InjectionToken,
  Module,
  Provider,
  Type,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OrganizationModule } from './organization/organization.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { EmailsModule } from './emails/emails.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AUTH_CONSTANTS } from './common/constants/auth.constants';
import {
  AUTH_MODULE_OPTIONS,
  AuthModuleOptions,
} from './common/interfaces/auth-module-options.interface';

export interface AuthModuleAsyncOptions {
  imports?: Array<Type<unknown> | DynamicModule>;
  inject?: unknown[];
  useFactory: (
    ...args: unknown[]
  ) => AuthModuleOptions | Promise<AuthModuleOptions>;
  global?: boolean;
}

@Module({})
export class AuthModule {
  /**
   * Registers auth with a static options object.
   *
   * @param options - JWT and token expiry configuration
   * @returns Configured dynamic module
   */
  static forRoot(options: AuthModuleOptions): DynamicModule {
    return this.forRootAsync({
      useFactory: () => options,
    });
  }

  /**
   * Registers auth with async factory options and a global JWT guard.
   *
   * @param options - Async Nest module registration options
   * @returns Configured dynamic module
   */
  static forRootAsync(options: AuthModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: AUTH_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: (options.inject ?? []) as InjectionToken[],
    };

    return {
      module: AuthModule,
      global: options.global ?? true,
      imports: [
        ...(options.imports ?? []),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          imports: options.imports ?? [],
          inject: (options.inject ?? []) as InjectionToken[],
          useFactory: async (...args: unknown[]) => {
            const authOptions = await options.useFactory(...args);
            return {
              secret: authOptions.jwtSecret,
              signOptions: {
                expiresIn: (authOptions.jwtAccessExpiresIn ??
                  AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_IN) as
                  number | `${number}${'s' | 'm' | 'h' | 'd'}`,
              },
            };
          },
        }),
        OrganizationModule,
        UsersModule,
        RolesModule,
        EmailsModule,
      ],
      controllers: [AuthController],
      providers: [
        optionsProvider,
        AuthService,
        JwtStrategy,
        JwtAuthGuard,
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
      ],
      exports: [
        AUTH_MODULE_OPTIONS,
        AuthService,
        JwtModule,
        PassportModule,
        JwtAuthGuard,
        OrganizationModule,
        UsersModule,
        RolesModule,
        EmailsModule,
      ],
    };
  }
}
