import { Controller, Post, Get, Body } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('manual')
  async manualSync(@Body() body: { password: string }) {
    return this.syncService.manualSync(body.password);
  }

  @Get('status')
  async getStatus() {
    return this.syncService.getStatus();
  }

  @Get('progress')
  getProgress() {
    return this.syncService.getProgress();
  }
}
