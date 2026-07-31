import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailLog } from './entities/email-log.entity';
import { EmailsService } from './emails.service';
import { BrevoEmailProvider } from './providers/brevo.provider';

/**
 * Email delivery and audit-log module for auth transactional messages.
 */
@Module({
    imports: [TypeOrmModule.forFeature([EmailLog])],
    providers: [EmailsService, BrevoEmailProvider],
    exports: [EmailsService, TypeOrmModule],
})
export class EmailsModule { }
