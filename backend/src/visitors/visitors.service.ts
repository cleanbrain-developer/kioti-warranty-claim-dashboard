import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VisitorsService {
  constructor(private prisma: PrismaService) {}

  async track(sessionId: string, ipAddress?: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    await this.prisma.visitorLog.upsert({
      where: { date_sessionId: { date: today, sessionId } },
      update: {},
      create: { date: today, sessionId, ipAddress },
    });
  }

  async getTodayCount(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    return this.prisma.visitorLog.count({ where: { date: today } });
  }
}
