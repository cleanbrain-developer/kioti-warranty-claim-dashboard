import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const [total, byStatus, totalAmountResult, hqCount, financialOrderCount, billingDocCount] =
      await Promise.all([
        this.prisma.warrantyClaim.count(),
        this.prisma.warrantyClaim.groupBy({
          by: ['status'],
          _count: { _all: true },
          _sum: { totalAmount: true },
        }),
        this.prisma.warrantyClaim.aggregate({ _sum: { totalAmount: true } }),
        this.prisma.hQClaim.count(),
        this.prisma.financialOrder.count(),
        this.prisma.billingDocument.count(),
      ]);

    const statusMap: Record<string, number> = {};
    const amountByStatus: Record<string, number> = {};
    for (const s of byStatus) {
      const key = s.status || 'Unassigned';
      statusMap[key] = s._count._all;
      amountByStatus[key] = s._sum.totalAmount ? Number(s._sum.totalAmount) : 0;
    }

    const openStatuses = ['Open', 'Pending', 'Submitted', 'Under Review', 'In Review', 'Pending Approval'];
    const approvedStatuses = ['Approved', 'Paid', 'Completed', 'Closed'];
    const rejectedStatuses = ['Rejected', 'Denied', 'Cancelled', 'Void'];

    const pending = Object.entries(statusMap)
      .filter(([k]) => openStatuses.some(s => k.toLowerCase().includes(s.toLowerCase())))
      .reduce((acc, [, v]) => acc + v, 0);

    const approved = Object.entries(statusMap)
      .filter(([k]) => approvedStatuses.some(s => k.toLowerCase().includes(s.toLowerCase())))
      .reduce((acc, [, v]) => acc + v, 0);

    const rejected = Object.entries(statusMap)
      .filter(([k]) => rejectedStatuses.some(s => k.toLowerCase().includes(s.toLowerCase())))
      .reduce((acc, [, v]) => acc + v, 0);

    return {
      total,
      pending,
      approved,
      rejected,
      other: total - pending - approved - rejected,
      totalAmount: totalAmountResult._sum.totalAmount ? Number(totalAmountResult._sum.totalAmount) : 0,
      hqClaimsCount: hqCount,
      financialOrdersCount: financialOrderCount,
      billingDocsCount: billingDocCount,
    };
  }

  async getByStatus() {
    const rows = await this.prisma.warrantyClaim.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { totalAmount: true },
      orderBy: { _count: { status: 'desc' } },
    });
    return rows.map(r => ({
      status: r.status || 'Unassigned',
      count: r._count._all,
      amount: r._sum.totalAmount ? Number(r._sum.totalAmount) : 0,
    }));
  }

  async getByDealer(limit = 15) {
    const rows = await this.prisma.warrantyClaim.groupBy({
      by: ['dealerName'],
      _count: { _all: true },
      _sum: { totalAmount: true },
      orderBy: { _count: { dealerName: 'desc' } },
      take: limit,
      where: { dealerName: { not: null } },
    });
    return rows.map(r => ({
      dealer: r.dealerName || 'Unknown',
      count: r._count._all,
      amount: r._sum.totalAmount ? Number(r._sum.totalAmount) : 0,
    }));
  }

  async getByModel(limit = 15) {
    const rows = await this.prisma.warrantyClaim.groupBy({
      by: ['modelName'],
      _count: { _all: true },
      _sum: { totalAmount: true },
      orderBy: { _count: { modelName: 'desc' } },
      take: limit,
      where: { modelName: { not: null } },
    });
    return rows.map(r => ({
      model: r.modelName || 'Unknown',
      count: r._count._all,
      amount: r._sum.totalAmount ? Number(r._sum.totalAmount) : 0,
    }));
  }

  async getMonthlyTrend(months = 12) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        TO_CHAR(COALESCE(submitted_date, created_at), 'YYYY-MM') as month,
        COUNT(*)::int as total,
        COUNT(CASE WHEN status ILIKE '%approved%' OR status ILIKE '%paid%' OR status ILIKE '%completed%' THEN 1 END)::int as approved,
        COUNT(CASE WHEN status ILIKE '%rejected%' OR status ILIKE '%denied%' THEN 1 END)::int as rejected,
        COALESCE(SUM(total_amount), 0)::float as total_amount
      FROM warranty_claims
      WHERE COALESCE(submitted_date, created_at) >= ${since}
      GROUP BY TO_CHAR(COALESCE(submitted_date, created_at), 'YYYY-MM')
      ORDER BY month ASC
    `;

    return rows;
  }

  async getAging() {
    const buckets = await this.prisma.$queryRaw<any[]>`
      WITH aged AS (
        SELECT
          EXTRACT(EPOCH FROM (NOW() - COALESCE(submitted_date, created_at))) / 86400 AS age_days,
          dealer_name,
          model_name,
          status,
          id
        FROM warranty_claims
        WHERE status NOT ILIKE '%approved%'
          AND status NOT ILIKE '%paid%'
          AND status NOT ILIKE '%rejected%'
          AND status NOT ILIKE '%closed%'
          AND status NOT ILIKE '%completed%'
      )
      SELECT
        COUNT(*) FILTER (WHERE age_days <= 30)::int as "0_30",
        COUNT(*) FILTER (WHERE age_days > 30 AND age_days <= 60)::int as "31_60",
        COUNT(*) FILTER (WHERE age_days > 60 AND age_days <= 90)::int as "61_90",
        COUNT(*) FILTER (WHERE age_days > 90 AND age_days <= 180)::int as "91_180",
        COUNT(*) FILTER (WHERE age_days > 180 AND age_days <= 365)::int as "181_365",
        COUNT(*) FILTER (WHERE age_days > 365)::int as "365_plus",
        COUNT(*)::int as total,
        AVG(age_days)::float as avg_age,
        MAX(age_days)::float as max_age
      FROM aged
    `;

    const byDealer = await this.prisma.$queryRaw<any[]>`
      WITH aged AS (
        SELECT
          dealer_name,
          EXTRACT(EPOCH FROM (NOW() - COALESCE(submitted_date, created_at))) / 86400 AS age_days
        FROM warranty_claims
        WHERE dealer_name IS NOT NULL
          AND status NOT ILIKE '%approved%'
          AND status NOT ILIKE '%paid%'
          AND status NOT ILIKE '%rejected%'
          AND status NOT ILIKE '%closed%'
          AND status NOT ILIKE '%completed%'
      )
      SELECT
        dealer_name as dealer,
        COUNT(*) FILTER (WHERE age_days <= 30)::int as "0_30",
        COUNT(*) FILTER (WHERE age_days > 30 AND age_days <= 60)::int as "31_60",
        COUNT(*) FILTER (WHERE age_days > 60 AND age_days <= 90)::int as "61_90",
        COUNT(*) FILTER (WHERE age_days > 90 AND age_days <= 180)::int as "91_180",
        COUNT(*) FILTER (WHERE age_days > 180 AND age_days <= 365)::int as "181_365",
        COUNT(*) FILTER (WHERE age_days > 365)::int as "365_plus",
        COUNT(*)::int as total,
        AVG(age_days)::float as avg_age
      FROM aged
      GROUP BY dealer_name
      ORDER BY total DESC
      LIMIT 15
    `;

    const byModel = await this.prisma.$queryRaw<any[]>`
      WITH aged AS (
        SELECT
          model_name,
          EXTRACT(EPOCH FROM (NOW() - COALESCE(submitted_date, created_at))) / 86400 AS age_days
        FROM warranty_claims
        WHERE model_name IS NOT NULL
          AND status NOT ILIKE '%approved%'
          AND status NOT ILIKE '%paid%'
          AND status NOT ILIKE '%rejected%'
          AND status NOT ILIKE '%closed%'
          AND status NOT ILIKE '%completed%'
      )
      SELECT
        model_name as model,
        COUNT(*) FILTER (WHERE age_days <= 30)::int as "0_30",
        COUNT(*) FILTER (WHERE age_days > 30 AND age_days <= 60)::int as "31_60",
        COUNT(*) FILTER (WHERE age_days > 60 AND age_days <= 90)::int as "61_90",
        COUNT(*) FILTER (WHERE age_days > 90 AND age_days <= 180)::int as "91_180",
        COUNT(*) FILTER (WHERE age_days > 180 AND age_days <= 365)::int as "181_365",
        COUNT(*) FILTER (WHERE age_days > 365)::int as "365_plus",
        COUNT(*)::int as total,
        AVG(age_days)::float as avg_age
      FROM aged
      GROUP BY model_name
      ORDER BY total DESC
      LIMIT 15
    `;

    const oldestClaims = await this.prisma.warrantyClaim.findMany({
      where: {
        status: {
          notIn: ['Approved', 'Paid', 'Rejected', 'Denied', 'Closed', 'Completed'],
        },
        submittedDate: { not: null },
      },
      orderBy: { submittedDate: 'asc' },
      take: 10,
      select: {
        id: true, sfId: true, claimNumber: true, dealerName: true, modelName: true,
        status: true, submittedDate: true, totalAmount: true,
      },
    });

    return {
      buckets: buckets[0] || {},
      byDealer,
      byModel,
      oldestClaims: oldestClaims.map(c => ({
        ...c,
        totalAmount: c.totalAmount ? Number(c.totalAmount) : null,
        ageDays: c.submittedDate
          ? Math.floor((Date.now() - c.submittedDate.getTime()) / 86400000)
          : null,
      })),
    };
  }
}
