import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { R2Service } from './r2.service';

/**
 * Cloud storage module for the API app.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [R2Service],
  exports: [R2Service],
})
export class CloudStorageModule {}
