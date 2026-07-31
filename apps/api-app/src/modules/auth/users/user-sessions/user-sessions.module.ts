import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSession } from './entities/user-session.entity';
import { UserSessionsService } from './user-sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserSession])],
  providers: [UserSessionsService],
  exports: [UserSessionsService, TypeOrmModule],
})
export class UserSessionsModule {}
