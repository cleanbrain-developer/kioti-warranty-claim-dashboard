import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { VisitorsService } from './visitors.service';
import { Request } from 'express';

@Controller('visitors')
export class VisitorsController {
  constructor(private visitorsService: VisitorsService) {}

  @Post('track')
  async track(@Body() body: { sessionId: string }, @Req() req: Request) {
    const ip = req.headers['x-forwarded-for']?.toString() || req.socket?.remoteAddress;
    await this.visitorsService.track(body.sessionId, ip);
    return { success: true };
  }

  @Get('today')
  async getToday() {
    const count = await this.visitorsService.getTodayCount();
    return { count };
  }
}
