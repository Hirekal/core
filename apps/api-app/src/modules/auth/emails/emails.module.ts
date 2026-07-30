import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailLog } from './entities/email-log.entity';
import { EmailsService } from './emails.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmailLog])],
  providers: [EmailsService],
  exports: [EmailsService, TypeOrmModule],
})
export class EmailsModule {}
