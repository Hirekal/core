import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCode } from './entities/user-code.entity';
import { UserCodesService } from './user-codes.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserCode])],
  providers: [UserCodesService],
  exports: [UserCodesService, TypeOrmModule],
})
export class UserCodesModule {}
