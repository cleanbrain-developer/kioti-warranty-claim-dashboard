import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface ClaimsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  dealer?: string;
  model?: string;
  assignee?: string;
  owner?: string;
  dateFrom?: string;
  dateTo?: string;
  hasHQProduct?: string;
  hasFinancialOrder?: string;
  hasBillingDocument?: string;
  openOnly?: string;
  scaOnly?: string;
  dateField?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

@Injectable()
export class ClaimsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private get sfDomain() {
    return this.config.get('SF_DOMAIN', '');
  }

  private sfLink(objectName: string, sfId: string): string {
    if (!sfId) return null;
    return `${this.sfDomain}/lightning/r/${objectName}/${sfId}/view`;
  }

  async findAll(q: ClaimsQuery) {
    const page = Math.max(1, q.page || 1);
    const limit = Math.min(200, Math.max(1, q.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (q.search) {
      where.OR = [
        { claimNumber: { contains: q.search, mode: 'insensitive' } },
        { dealerName: { contains: q.search, mode: 'insensitive' } },
        { serialNumber: { contains: q.search, mode: 'insensitive' } },
        { modelName: { contains: q.search, mode: 'insensitive' } },
        { hqClaims: { some: { hqClaimNumber: { contains: q.search, mode: 'insensitive' } } } },
        { financialOrders: { some: { orderNumber: { contains: q.search, mode: 'insensitive' } } } },
        { financialOrders: { some: { billingDocuments: { some: { documentNumber: { contains: q.search, mode: 'insensitive' } } } } } },
      ];
    }

    if (q.status) {
      const statuses = q.status.split(',').map((s: string) => s.trim()).filter(Boolean);
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    if (q.dealer) where.dealerName = { equals: q.dealer, mode: 'insensitive' };
    if (q.model) where.modelName = { contains: q.model, mode: 'insensitive' };
    if (q.assignee) where.assignedTo = { contains: q.assignee, mode: 'insensitive' };
    if (q.owner) where.owner = { contains: q.owner, mode: 'insensitive' };

    // Has HQ Claim: use relation (more accurate than hasHQProduct boolean)
    if (q.hasHQProduct === 'true') where.hqClaims = { some: {} };

    // Has Financial Order / Has Billing Document — resolve without overwrite
    if (q.hasBillingDocument === 'true') {
      // billing doc implies financial order exists (they're nested under it)
      where.financialOrders = { some: { billingDocuments: { some: {} } } };
    } else if (q.hasFinancialOrder === 'true') {
      where.financialOrders = { some: {} };
    }

    if (q.openOnly === 'true') {
      const closedTerms = ['approved', 'paid', 'rejected', 'closed', 'completed', 'denied', 'cancel'];
      where.AND = [
        ...(where.AND || []),
        ...closedTerms.map(term => ({
          NOT: { status: { contains: term, mode: 'insensitive' as const } },
        })),
      ];
    }

    // SCA claims: authorization number starts with "SCA-" — uses the exact same detection
    // SQL as getSCAClaimsByMonth in analytics.service.ts so chart counts and list counts match
    if (q.scaOnly === 'true') {
      const scaRows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM warranty_claims
        WHERE raw_data IS NOT NULL
          AND (
            (raw_data->>'Authorization_Number__c') LIKE 'SCA-%'
            OR (raw_data->>'Authorization_Number__c') LIKE 'sca-%'
            OR raw_data::text LIKE '%"SCA-%'
          )
          AND (
            (raw_data->>'Authorization_Number__c') IS NULL
            OR (raw_data->>'Authorization_Number__c') NOT ILIKE '%HCR%'
          )
      `;
      where.id = { in: scaRows.map(r => r.id) };
    }

    // Which date column the dateFrom/dateTo range applies to — defaults to submittedDate
    // for backward compatibility with existing Aging/Insights click-through links.
    const dateFieldMap: Record<string, string> = {
      createdDate: 'sfCreatedDate',
      submittedDate: 'submittedDate',
      failureDate: 'failureDate',
      repairDate: 'repairDate',
      approvedDate: 'approvedDate',
    };
    const targetDateField = dateFieldMap[q.dateField] || 'submittedDate';

    if (q.dateFrom || q.dateTo) {
      const dateCond: any = {};
      if (q.dateFrom) dateCond.gte = new Date(q.dateFrom);
      if (q.dateTo) dateCond.lte = new Date(q.dateTo);

      if (q.scaOnly === 'true' && targetDateField === 'submittedDate') {
        // SCA monthly chart groups by COALESCE(submittedDate, createdAt) — match that here so counts line up
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { submittedDate: dateCond },
              { AND: [{ submittedDate: null }, { createdAt: dateCond }] },
            ],
          },
        ];
      } else {
        where[targetDateField] = dateCond;
      }
    }

    const validSortFields = ['submittedDate', 'repairDate', 'failureDate', 'approvedDate', 'totalAmount', 'status', 'dealerName', 'modelName', 'claimNumber', 'sfCreatedDate', 'assignedTo', 'owner'];
    const sortBy = validSortFields.includes(q.sortBy) ? q.sortBy : 'sfCreatedDate';
    const sortDir = q.sortDir === 'asc' ? 'asc' : 'desc';

    const [total, totalUnfiltered, records] = await Promise.all([
      this.prisma.warrantyClaim.count({ where }),
      this.prisma.warrantyClaim.count(),
      this.prisma.warrantyClaim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortDir },
        include: {
          hqClaims: {
            select: { id: true, sfId: true, hqClaimNumber: true, status: true, judgmentResult: true, totalAmount: true },
          },
          financialOrders: {
            select: {
              id: true, sfId: true, orderNumber: true, orderType: true, status: true, amount: true, orderDate: true,
              erpStatus: true, erpErrorMessage: true,
              billingDocuments: {
                select: { id: true, sfId: true, documentNumber: true, documentType: true, status: true, amount: true, billingDate: true },
              },
            },
          },
        },
      }),
    ]);

    const data = records.map(r => ({
      ...r,
      // Amount fallback chain:
      //   P1: total_amount DB column
      //   P2: labor_amount + parts_amount DB columns
      //   P3: adaptive raw_data scan — sums fields whose key contains 'labor' or 'part'
      //       so it works regardless of KIOTI-specific SF custom field naming
      totalAmount: (() => {
        if (r.totalAmount) return Number(r.totalAmount);
        if (r.laborAmount != null || r.partsAmount != null)
          return Number(r.laborAmount ?? 0) + Number(r.partsAmount ?? 0);
        const rd = r.rawData as Record<string, any> | null;
        if (rd && typeof rd === 'object') {
          let sum = 0;
          for (const [k, v] of Object.entries(rd)) {
            if (v == null) continue;
            const lk = k.toLowerCase();
            const isLaborField = lk.includes('labor') && !lk.includes('description') && !lk.includes('type') && !lk.includes('date') && !lk.includes('number');
            const isPartsField = lk.includes('part') && !lk.includes('department') && !lk.includes('partner') && !lk.includes('description') && !lk.includes('type') && !lk.includes('date') && !lk.includes('number');
            if (!isLaborField && !isPartsField) continue;
            const n = typeof v === 'number' ? v : parseFloat(String(v));
            if (!isNaN(n) && n > 0) sum += n;
          }
          if (sum > 0) return sum;
        }
        return null;
      })(),
      laborAmount: r.laborAmount ? Number(r.laborAmount) : null,
      partsAmount: r.partsAmount ? Number(r.partsAmount) : null,
      // Fall back to SF record Owner name when the custom assignedTo field is unmapped
      assignedTo: r.assignedTo || r.owner || null,
      sfLink: this.sfLink('Claim__c', r.sfId),
      hqClaims: r.hqClaims.map(h => ({
        ...h,
        totalAmount: h.totalAmount ? Number(h.totalAmount) : null,
        sfLink: this.sfLink('HQClaim__c', h.sfId),
      })),
      financialOrders: r.financialOrders.map(o => ({
        ...o,
        amount: o.amount ? Number(o.amount) : null,
        sfLink: this.sfLink('FinancialOrder__c', o.sfId),
        billingDocuments: o.billingDocuments.map(d => ({
          ...d,
          amount: d.amount ? Number(d.amount) : null,
          sfLink: this.sfLink('BillingDocument__c', d.sfId),
        })),
      })),
      rawData: undefined,
    }));

    return { data, total, totalUnfiltered, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const r = await this.prisma.warrantyClaim.findUnique({
      where: { id },
      include: {
        hqClaims: true,
        financialOrders: { include: { billingDocuments: true } },
      },
    });
    if (!r) return null;
    return {
      ...r,
      totalAmount: r.totalAmount ? Number(r.totalAmount) : null,
      sfLink: this.sfLink('Claim__c', r.sfId),
      hqClaims: r.hqClaims.map(h => ({ ...h, sfLink: this.sfLink('HQClaim__c', h.sfId), totalAmount: h.totalAmount ? Number(h.totalAmount) : null })),
      financialOrders: r.financialOrders.map(o => ({
        ...o,
        amount: o.amount ? Number(o.amount) : null,
        sfLink: this.sfLink('FinancialOrder__c', o.sfId),
        billingDocuments: o.billingDocuments.map(d => ({
          ...d,
          amount: d.amount ? Number(d.amount) : null,
          sfLink: this.sfLink('BillingDocument__c', d.sfId),
        })),
      })),
    };
  }

  async getFilterOptions() {
    const [statuses, dealers, assignees, owners] = await Promise.all([
      this.prisma.warrantyClaim.groupBy({ by: ['status'], where: { status: { not: null } }, orderBy: { status: 'asc' } }),
      this.prisma.warrantyClaim.groupBy({ by: ['dealerName'], where: { dealerName: { not: null } }, orderBy: { dealerName: 'asc' } }),
      this.prisma.warrantyClaim.groupBy({ by: ['assignedTo'], where: { assignedTo: { not: null } }, orderBy: { assignedTo: 'asc' } }),
      this.prisma.warrantyClaim.groupBy({ by: ['owner'], where: { owner: { not: null } }, orderBy: { owner: 'asc' } }),
    ]);
    return {
      statuses: statuses.map(s => s.status).filter(Boolean),
      dealers: dealers.map(d => d.dealerName).filter(Boolean),
      assignees: assignees.map(a => a.assignedTo).filter(Boolean),
      owners: owners.map(o => (o as any).owner).filter(Boolean),
    };
  }
}
