import { Controller, Post, Get, Body, Req, Query } from '@nestjs/common';
import { VisitorsService } from './visitors.service';
import { Request } from 'express';

@Controller('visitors')
export class VisitorsController {
  constructor(private visitorsService: VisitorsService) {}

  @Post('track')
  async track(@Body() body: { sessionId: string; tz?: string }, @Req() req: Request) {
    const ip = req.headers['x-forwarded-for']?.toString() || req.socket?.remoteAddress;
    await this.visitorsService.track(body.sessionId, ip, body.tz);
    return { success: true };
  }

  @Get('today')
  async getToday(@Query('tz') tz?: string) {
    const count = await this.visitorsService.getTodayCount(tz);
    return { count };
  }
}
