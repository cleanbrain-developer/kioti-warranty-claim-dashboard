import { Controller, Get, Param, Query } from '@nestjs/common';
import { ClaimsService } from './claims.service';

@Controller('claims')
export class ClaimsController {
  constructor(private claimsService: ClaimsService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.claimsService.findAll({
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      search: query.search,
      status: query.status,
      dealer: query.dealer,
      model: query.model,
      assignee: query.assignee,
      owner: query.owner,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      dateField: query.dateField,
      hasHQProduct: query.hasHQProduct,
      hasFinancialOrder: query.hasFinancialOrder,
      hasBillingDocument: query.hasBillingDocument,
      openOnly: query.openOnly,
      scaOnly: query.scaOnly,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    });
  }

  @Get('filter-options')
  getFilterOptions() {
    return this.claimsService.getFilterOptions();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.claimsService.findOne(id);
  }
}
