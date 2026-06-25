import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULTS: Record<string, string> = {
  scheduledSyncMode: 'incremental',
  scheduledSyncHour: '1',
  scheduledSyncMinute: '0',
};

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.appSetting.findMany();
    const result = { ...DEFAULTS };
    for (const r of rows) result[r.key] = r.value;
    return result;
  }

  async get(key: string): Promise<string> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    return row?.value ?? DEFAULTS[key] ?? '';
  }

  async setMany(data: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      await this.prisma.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }
  }

  async getScheduledSyncMode(): Promise<'incremental' | 'full'> {
    const v = await this.get('scheduledSyncMode');
    return v === 'full' ? 'full' : 'incremental';
  }

  async getScheduledSyncHour(): Promise<number> {
    const v = await this.get('scheduledSyncHour');
    const h = parseInt(v, 10);
    return isNaN(h) ? 1 : Math.max(0, Math.min(23, h));
  }

  async getScheduledSyncMinute(): Promise<number> {
    const v = await this.get('scheduledSyncMinute');
    const m = parseInt(v, 10);
    return isNaN(m) ? 0 : Math.max(0, Math.min(59, m));
  }

  getNextRun(hour: number, minute: number): Date {
    const now = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }
}
