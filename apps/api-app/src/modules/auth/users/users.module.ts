import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserRolesModule } from './user-roles/user-roles.module';
import { UserSessionsModule } from './user-sessions/user-sessions.module';
import { UserCodesModule } from './user-codes/user-codes.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    UserRolesModule,
    UserSessionsModule,
    UserCodesModule,
    RolesModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [
    UsersService,
    TypeOrmModule,
    UserRolesModule,
    UserSessionsModule,
    UserCodesModule,
  ],
})
export class UsersModule {}
