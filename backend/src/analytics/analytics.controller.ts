import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getOverview(dateFrom, dateTo);
  }

  @Get('by-status')
  getByStatus(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getByStatus(dateFrom, dateTo);
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

  @Get('open-by-dealer')
  getOpenByDealer(@Query('limit') limit?: string) {
    return this.analyticsService.getOpenByDealer(limit ? parseInt(limit) : 20);
  }

  @Get('by-assignee')
  getByAssignee(@Query('limit') limit?: string) {
    return this.analyticsService.getByAssignee(limit ? parseInt(limit) : 20);
  }

  @Get('assignees')
  getAssignees() {
    return this.analyticsService.getAssignees();
  }

  @Get('financial-summary')
  getFinancialSummary(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getFinancialSummary(dateFrom, dateTo);
  }

  @Get('aging')
  getAging() {
    return this.analyticsService.getAging();
  }
}
