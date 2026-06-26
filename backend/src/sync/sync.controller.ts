import { Controller, Post, Get, Patch, Body, Query } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('manual')
  async manualSync(@Body() body: { password: string; force?: boolean }) {
    return this.syncService.manualSync(body.password, body.force || false);
  }

  @Get('status')
  async getStatus() {
    return this.syncService.getStatus();
  }

  @Get('progress')
  getProgress() {
    return this.syncService.getProgress();
  }

  @Get('field-mappings')
  async getFieldMappings() {
    return this.syncService.getFieldMappings();
  }

  @Get('describe-fields')
  async describeFields(@Query('object') objectName?: string) {
    return this.syncService.describeObjectFields(objectName);
  }

  @Post('reset-field-mappings')
  async resetFieldMappings() {
    return this.syncService.resetFieldMappings();
  }

  @Get('diagnose-amounts')
  async diagnoseAmounts() {
    return this.syncService.diagnoseAmounts();
  }

  @Get('settings')
  async getSettings() {
    return this.syncService.getSettingsData();
  }

  @Patch('settings')
  async updateSettings(@Body() body: Record<string, string>) {
    return this.syncService.updateSettingsData(body);
  }
}
