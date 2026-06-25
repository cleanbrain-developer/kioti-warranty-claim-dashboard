import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview() {
    return this.analyticsService.getOverview();
  }

  @Get('by-status')
  getByStatus() {
    return this.analyticsService.getByStatus();
  }

  @Get('by-dealer')
  getByDealer(@Query('limit') limit?: string) {
    return this.analyticsService.getByDealer(limit ? parseInt(limit) : 15);
  }

  @Get('by-model')
  getByModel(@Query('limit') limit?: string) {
    return this.analyticsService.getByModel(limit ? parseInt(limit) : 15);
  }

  @Get('monthly-trend')
  getMonthlyTrend(@Query('months') months?: string) {
    return this.analyticsService.getMonthlyTrend(months ? parseInt(months) : 12);
  }

  @Get('aging')
  getAging() {
    return this.analyticsService.getAging();
  }
}
