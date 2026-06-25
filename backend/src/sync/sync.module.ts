import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { SalesforceModule } from '../salesforce/salesforce.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SalesforceModule, SettingsModule],
  providers: [SyncService],
  controllers: [SyncController],
  exports: [SyncService],
})
export class SyncModule {}
