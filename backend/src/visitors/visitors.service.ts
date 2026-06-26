import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VisitorsService {
  constructor(private prisma: PrismaService) {}

  private localDate(tz?: string): string {
    const resolved = tz && tz !== 'local' ? tz : 'UTC';
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: resolved }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  async track(sessionId: string, ipAddress?: string, tz?: string): Promise<void> {
    const today = this.localDate(tz);
    await this.prisma.visitorLog.upsert({
      where: { date_sessionId: { date: today, sessionId } },
      update: {},
      create: { date: today, sessionId, ipAddress },
    });
  }

  async getTodayCount(tz?: string): Promise<number> {
    const today = this.localDate(tz);
    return this.prisma.visitorLog.count({ where: { date: today } });
  }
}
