import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { SalesforceModule } from './salesforce/salesforce.module';
import { SyncModule } from './sync/sync.module';
import { ClaimsModule } from './claims/claims.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { VisitorsModule } from './visitors/visitors.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    SalesforceModule,
    SyncModule,
    ClaimsModule,
    AnalyticsModule,
    VisitorsModule,
    SettingsModule,
  ],
})
export class AppModule {}
