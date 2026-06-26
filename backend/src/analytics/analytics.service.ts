import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const [total, byStatus, totalAmountResult, hqCount, financialOrderCount, billingDocCount, hqAmountResult] =
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
        // Fallback: total from HQ claims when claim-level amount is unavailable
        this.prisma.hQClaim.aggregate({ _sum: { totalAmount: true } }),
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

    const statusBreakdown = Object.entries(statusMap)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const claimTotal = totalAmountResult._sum.totalAmount ? Number(totalAmountResult._sum.totalAmount) : 0;
    const hqTotal = hqAmountResult._sum.totalAmount ? Math.abs(Number(hqAmountResult._sum.totalAmount)) : 0;

    return {
      total,
      pending,
      approved,
      totalAmount: claimTotal || hqTotal,
      totalAmountSource: claimTotal > 0 ? 'claims' : (hqTotal > 0 ? 'hq' : 'none'),
      hqClaimsCount: hqCount,
      financialOrdersCount: financialOrderCount,
      billingDocsCount: billingDocCount,
      statusBreakdown,
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

  async getOpenByDealer(limit = 20) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(dealer_name, 'Unknown') as dealer,
        COUNT(*)::int as total,
        COUNT(CASE WHEN status NOT ILIKE '%approved%' AND status NOT ILIKE '%paid%'
          AND status NOT ILIKE '%rejected%' AND status NOT ILIKE '%closed%'
          AND status NOT ILIKE '%completed%' AND status NOT ILIKE '%denied%'
          AND status NOT ILIKE '%cancel%' THEN 1 END)::int as open,
        COUNT(CASE WHEN status ILIKE '%approved%' OR status ILIKE '%paid%' OR status ILIKE '%completed%' THEN 1 END)::int as approved,
        COUNT(CASE WHEN status ILIKE '%rejected%' OR status ILIKE '%denied%' THEN 1 END)::int as rejected,
        COUNT(CASE WHEN status ILIKE '%pending%' OR status ILIKE '%submitted%' OR status ILIKE '%review%' THEN 1 END)::int as pending
      FROM warranty_claims
      WHERE dealer_name IS NOT NULL
      GROUP BY COALESCE(dealer_name, 'Unknown')
      ORDER BY open DESC, total DESC
      LIMIT ${limit}
    `;
    return rows;
  }

  async getByAssignee(limit = 20) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(assigned_to, 'Unassigned') as assignee,
        COUNT(*)::int as total,
        COUNT(CASE WHEN status NOT ILIKE '%approved%' AND status NOT ILIKE '%paid%'
          AND status NOT ILIKE '%rejected%' AND status NOT ILIKE '%closed%'
          AND status NOT ILIKE '%completed%' AND status NOT ILIKE '%denied%'
          AND status NOT ILIKE '%cancel%' THEN 1 END)::int as open,
        COUNT(CASE WHEN status ILIKE '%approved%' OR status ILIKE '%paid%' OR status ILIKE '%completed%' THEN 1 END)::int as approved,
        COUNT(CASE WHEN status ILIKE '%rejected%' OR status ILIKE '%denied%' THEN 1 END)::int as rejected,
        COUNT(CASE WHEN status ILIKE '%pending%' OR status ILIKE '%submitted%' OR status ILIKE '%review%' THEN 1 END)::int as pending
      FROM warranty_claims
      GROUP BY COALESCE(assigned_to, 'Unassigned')
      ORDER BY open DESC, total DESC
      LIMIT ${limit}
    `;
    return rows;
  }

  async getAssignees() {
    const rows = await this.prisma.warrantyClaim.groupBy({
      by: ['assignedTo'],
      where: { assignedTo: { not: null } },
      orderBy: { assignedTo: 'asc' },
    });
    return rows.map(r => r.assignedTo).filter(Boolean);
  }

  async getFinancialSummary() {
    const [hqClaimed, dealerPaid, dealerOutstanding] = await Promise.all([
      // HQ Claimed = sum of HQ Claim amounts per currency (what dealers billed to HQ Korea)
      this.prisma.$queryRaw<{ currency: string; total: number }[]>`
        SELECT COALESCE(currency_iso_code, 'USD') as currency,
               ABS(COALESCE(SUM(total_amount), 0))::float as total
        FROM hq_claims
        WHERE total_amount IS NOT NULL
        GROUP BY COALESCE(currency_iso_code, 'USD')
        ORDER BY total DESC
      `,
      // Dealer Paid = Billing Documents per currency (credit memos issued to dealers — ABS because stored as negative)
      this.prisma.$queryRaw<{ currency: string; total: number }[]>`
        SELECT COALESCE(currency_iso_code, 'USD') as currency,
               ABS(COALESCE(SUM(amount), 0))::float as total
        FROM billing_documents
        WHERE amount IS NOT NULL
        GROUP BY COALESCE(currency_iso_code, 'USD')
        ORDER BY total DESC
      `,
      // Dealer Outstanding = Financial Orders with no billing document yet (payment initiated but not settled)
      this.prisma.$queryRaw<{ currency: string; total: number }[]>`
        SELECT COALESCE(fo.currency_iso_code, 'USD') as currency,
               ABS(COALESCE(SUM(fo.amount), 0))::float as total
        FROM financial_orders fo
        WHERE fo.amount IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM billing_documents bd WHERE bd.financial_order_id = fo.id
          )
        GROUP BY COALESCE(fo.currency_iso_code, 'USD')
        ORDER BY total DESC
      `,
    ]);

    return {
      hqClaimed,
      dealerPaid,
      dealerOutstanding,
    };
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
          AND status NOT ILIKE '%cancel%'
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
          AND status NOT ILIKE '%cancel%'
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
          AND status NOT ILIKE '%cancel%'
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

    const oldestClaims = await this.prisma.$queryRaw<any[]>`
      SELECT id, sf_id as "sfId", claim_number as "claimNumber",
             dealer_name as "dealerName", model_name as "modelName",
             status, submitted_date as "submittedDate",
             total_amount::float as "totalAmount",
             EXTRACT(EPOCH FROM (NOW() - COALESCE(submitted_date, created_at))) / 86400 AS "ageDays"
      FROM warranty_claims
      WHERE status IS NOT NULL
        AND status NOT ILIKE '%approved%'
        AND status NOT ILIKE '%paid%'
        AND status NOT ILIKE '%rejected%'
        AND status NOT ILIKE '%closed%'
        AND status NOT ILIKE '%completed%'
        AND status NOT ILIKE '%denied%'
        AND status NOT ILIKE '%cancel%'
        AND COALESCE(submitted_date, created_at) IS NOT NULL
      ORDER BY COALESCE(submitted_date, created_at) ASC
      LIMIT 10
    `;

    return {
      buckets: buckets[0] || {},
      byDealer,
      byModel,
      oldestClaims: oldestClaims.map(c => ({
        ...c,
        totalAmount: c.totalAmount ? Number(c.totalAmount) : null,
        ageDays: c.ageDays ? Math.floor(Number(c.ageDays)) : null,
      })),
    };
  }
}
