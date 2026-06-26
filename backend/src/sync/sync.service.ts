import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service';
import { SalesforceService } from '../salesforce/salesforce.service';
import { SettingsService } from '../settings/settings.service';

export interface SyncProgress {
  phase: 'idle' | 'fetching_claims' | 'syncing_claims' | 'syncing_dealers' | 'syncing_hq' | 'syncing_orders' | 'syncing_docs' | 'done' | 'error';
  phaseLabel: string;
  claimsFetched: number;
  claimsSynced: number;
  claimsTotal: number;
  dealersSynced: number;
  hqSynced: number;
  ordersSynced: number;
  docsSynced: number;
  elapsedSeconds: number;
  startedAt: string | null;
  errorMessage: string | null;
}

const DB_BATCH_SIZE = 1000; // same-network DB: large batches are safe

@Injectable()
export class SyncService implements OnModuleInit {
  private readonly logger = new Logger(SyncService.name);
  private isSyncing = false;

  private progress: SyncProgress = {
    phase: 'idle',
    phaseLabel: '',
    claimsFetched: 0,
    claimsSynced: 0,
    claimsTotal: 0,
    dealersSynced: 0,
    hqSynced: 0,
    ordersSynced: 0,
    docsSynced: 0,
    elapsedSeconds: 0,
    startedAt: null,
    errorMessage: null,
  };
  private syncStartedAt: Date | null = null;

  constructor(
    private prisma: PrismaService,
    private sf: SalesforceService,
    private config: ConfigService,
    private schedulerRegistry: SchedulerRegistry,
    private settingsService: SettingsService,
  ) {}

  async onModuleInit() {
    await this.reregisterCronJob();
  }

  async reregisterCronJob(): Promise<void> {
    const hour = await this.settingsService.getScheduledSyncHour();
    const minute = await this.settingsService.getScheduledSyncMinute();

    try {
      const existing = this.schedulerRegistry.getCronJob('scheduled_sync');
      existing.stop();
      this.schedulerRegistry.deleteCronJob('scheduled_sync');
    } catch {}

    const job = new CronJob(`${minute} ${hour} * * *`, async () => {
      this.logger.log('Starting scheduled sync');
      const mode = await this.settingsService.getScheduledSyncMode();
      await this.performSync('scheduled', mode === 'full');
    });

    this.schedulerRegistry.addCronJob('scheduled_sync', job);
    job.start();
    this.logger.log(`Scheduled sync cron: ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} daily`);
  }

  async manualSync(password: string, force = false): Promise<{ success: boolean; message: string }> {
    const expected = this.config.get('SYNC_PASSWORD', 'kioti');
    if (password !== expected) {
      return { success: false, message: 'Invalid password' };
    }
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress' };
    }
    this.performSync('manual', force).catch(err => this.logger.error('Manual sync failed', err));
    return { success: true, message: force ? 'Full sync started (re-syncing all records)' : 'Sync started' };
  }

  async getSettingsData() {
    const all = await this.settingsService.getAll();
    const hour = parseInt(all.scheduledSyncHour || '1', 10);
    const minute = parseInt(all.scheduledSyncMinute || '0', 10);
    const nextRun = this.settingsService.getNextRun(hour, minute);

    const lastScheduledSync = await this.prisma.syncLog.findFirst({
      where: { syncType: 'scheduled', status: 'success' },
      orderBy: { completedAt: 'desc' },
    });

    return {
      ...all,
      nextRun: nextRun.toISOString(),
      lastScheduledSync: lastScheduledSync?.completedAt ?? null,
    };
  }

  async updateSettingsData(data: Record<string, string>) {
    const allowed = ['scheduledSyncMode', 'scheduledSyncHour', 'scheduledSyncMinute'];
    const filtered = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
    await this.settingsService.setMany(filtered);
    await this.reregisterCronJob();
    return this.getSettingsData();
  }

  async describeObjectFields(objectName?: string): Promise<{ name: string; label: string; type: string; referenceTo?: string[] }[]> {
    const target = objectName || this.config.get<string>('SF_CLAIM_OBJECT', 'Claim__c');
    const desc = await this.sf.describe(target);
    return desc.fields
      .map(f => ({ name: f.name, label: f.label, type: f.type, referenceTo: f.referenceTo }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getFieldMappings(): Promise<Record<string, string>> {
    const claimObject = this.config.get<string>('SF_CLAIM_OBJECT', 'Claim__c');
    const mappings = await this.prisma.fieldMapping.findMany({ where: { objectName: claimObject } });
    const result: Record<string, string> = {};
    for (const m of mappings) result[m.fieldKey] = m.fieldName;
    return result;
  }

  async resetFieldMappings(): Promise<{ discovered: Record<string, string>; count: number }> {
    const claimObject = this.config.get<string>('SF_CLAIM_OBJECT', 'Claim__c');
    await this.prisma.fieldMapping.deleteMany({ where: { objectName: claimObject } });
    this.sf.resetFieldMapping();
    await this.sf.loadFieldMapping();
    const newMappings = await this.prisma.fieldMapping.findMany({ where: { objectName: claimObject } });
    const discovered: Record<string, string> = {};
    for (const m of newMappings) discovered[m.fieldKey] = m.fieldName;
    return { discovered, count: newMappings.length };
  }

  async diagnoseAmounts(): Promise<{
    fieldMapping: Record<string, string>;
    claimAmountStats: { nonNullCount: number; total: number; sampleValues: (number | null)[] };
    currencyFieldsOnClaimObject: string[];
  }> {
    const claimObject = this.config.get<string>('SF_CLAIM_OBJECT', 'Claim__c');
    const [mappings, stats, sampleRaws] = await Promise.all([
      this.prisma.fieldMapping.findMany({ where: { objectName: claimObject } }),
      this.prisma.$queryRaw<[{ non_null: number; total: number }]>`
        SELECT COUNT(*) FILTER (WHERE total_amount IS NOT NULL)::int as non_null,
               COUNT(*)::int as total
        FROM warranty_claims
      `,
      this.prisma.$queryRaw<[{ raw_data: any }]>`
        SELECT raw_data FROM warranty_claims
        WHERE raw_data IS NOT NULL LIMIT 1
      `,
    ]);

    const mapping: Record<string, string> = {};
    for (const m of mappings) mapping[m.fieldKey] = m.fieldName;

    const row = (stats as any[])[0] || { non_null: 0, total: 0 };
    const nonNullCount = Number(row.non_null);
    const total = Number(row.total);

    // Extract currency-like field names from rawData of a sample claim
    let currencyFieldsOnClaimObject: string[] = [];
    const sample = (sampleRaws as any[])[0]?.raw_data;
    if (sample) {
      currencyFieldsOnClaimObject = Object.entries(sample)
        .filter(([, v]) => typeof v === 'number' || v === null)
        .filter(([k]) => k.toLowerCase().includes('amount') || k.toLowerCase().includes('price') || k.toLowerCase().includes('cost') || k.toLowerCase().includes('total') || k.toLowerCase().includes('pay'))
        .map(([k, v]) => `${k}=${v}`)
        .slice(0, 30);
    }

    const sampleValues = await this.prisma.$queryRaw<[{ v: number | null }]>`
      SELECT total_amount::float as v FROM warranty_claims WHERE total_amount IS NOT NULL LIMIT 5
    `.then(rows => (rows as any[]).map(r => r.v)).catch(() => []);

    return { fieldMapping: mapping, claimAmountStats: { nonNullCount, total, sampleValues }, currencyFieldsOnClaimObject };
  }

  getProgress(): SyncProgress {
    if (this.isSyncing && this.syncStartedAt) {
      return {
        ...this.progress,
        elapsedSeconds: Math.floor((Date.now() - this.syncStartedAt.getTime()) / 1000),
      };
    }
    return this.progress;
  }

  async getStatus(): Promise<{ isSyncing: boolean; lastSync: any; recentLogs: any[] }> {
    const [lastSuccess, recent] = await Promise.all([
      this.prisma.syncLog.findFirst({
        where: { status: 'success' },
        orderBy: { completedAt: 'desc' },
      }),
      this.prisma.syncLog.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
    ]);
    return { isSyncing: this.isSyncing, lastSync: lastSuccess, recentLogs: recent };
  }

  private setPhase(phase: SyncProgress['phase'], label: string) {
    this.progress.phase = phase;
    this.progress.phaseLabel = label;
    this.logger.log(`[Sync] Phase: ${label}`);
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
    return result;
  }

  async performSync(syncType: 'scheduled' | 'manual', force = false) {
    if (this.isSyncing) {
      this.logger.warn('Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;
    this.syncStartedAt = new Date();
    this.progress = {
      phase: 'fetching_claims',
      phaseLabel: 'Connecting to Salesforce…',
      claimsFetched: 0,
      claimsSynced: 0,
      claimsTotal: 0,
      dealersSynced: 0,
      hqSynced: 0,
      ordersSynced: 0,
      docsSynced: 0,
      elapsedSeconds: 0,
      startedAt: this.syncStartedAt.toISOString(),
      errorMessage: null,
    };

    const startedAt = this.syncStartedAt;
    const log = await this.prisma.syncLog.create({
      data: { syncType, status: 'running', startedAt },
    });

    let claimsSynced = 0;
    let dealersSynced = 0;
    let hqClaimsSynced = 0;
    let ordersSynced = 0;
    let docsSynced = 0;

    try {
      const lastSuccessLog = await this.prisma.syncLog.findFirst({
        where: { status: 'success' },
        orderBy: { completedAt: 'desc' },
      });
      const lastSyncDate = force ? null : (lastSuccessLog?.completedAt || null);

      this.logger.log(`Syncing claims ${lastSyncDate ? `since ${lastSyncDate.toISOString()}` : '(full sync)'}`);

      // ── 1. Fetch Warranty Claims ──────────────────────────
      this.setPhase('fetching_claims', lastSyncDate
        ? `Fetching claims modified since ${lastSyncDate.toLocaleDateString('en-US')}…`
        : 'Fetching all warranty claims from Salesforce…');

      const claimsRaw = await this.sf.getWarrantyClaims(lastSyncDate);
      this.progress.claimsFetched = claimsRaw.length;
      this.progress.claimsTotal = claimsRaw.length;
      this.logger.log(`Fetched ${claimsRaw.length} claims from Salesforce`);

      // ── 2. Sync Claims to DB (batched transactions) ───────
      this.setPhase('syncing_claims', `Syncing ${claimsRaw.length.toLocaleString()} claims to database…`);

      const claimSfIds: string[] = [];
      const dealerAccountIds = new Set<string>();
      const mappedClaims = claimsRaw.map(raw => {
        const mapped = this.sf.mapClaim(raw);
        claimSfIds.push(raw.Id);
        if (mapped.dealerAccountId) dealerAccountIds.add(mapped.dealerAccountId);
        return mapped;
      });

      for (const batch of this.chunk(mappedClaims, DB_BATCH_SIZE)) {
        await this.prisma.$transaction(
          batch.map(mapped =>
            this.prisma.warrantyClaim.upsert({
              where: { sfId: mapped.sfId },
              update: {
                claimNumber: mapped.claimNumber,
                claimType: mapped.claimType,
                status: mapped.status,
                dealerAccountId: mapped.dealerAccountId,
                dealerName: mapped.dealerName,
                modelName: mapped.modelName,
                serialNumber: mapped.serialNumber,
                repairDate: mapped.repairDate,
                submittedDate: mapped.submittedDate,
                approvedDate: mapped.approvedDate,
                rejectedDate: mapped.rejectedDate,
                totalAmount: mapped.totalAmount,
                laborAmount: mapped.laborAmount,
                partsAmount: mapped.partsAmount,
                hasHQProduct: mapped.hasHQProduct,
                assignedTo: mapped.assignedTo,
                owner: mapped.owner,
                currencyIsoCode: mapped.currencyIsoCode,
                sfCreatedDate: mapped.sfCreatedDate,
                sfLastModified: mapped.sfLastModified,
                rawData: mapped.rawData,
              },
              create: {
                id: mapped.id,
                sfId: mapped.sfId,
                claimNumber: mapped.claimNumber,
                claimType: mapped.claimType,
                status: mapped.status,
                dealerAccountId: mapped.dealerAccountId,
                dealerName: mapped.dealerName,
                modelName: mapped.modelName,
                serialNumber: mapped.serialNumber,
                repairDate: mapped.repairDate,
                submittedDate: mapped.submittedDate,
                approvedDate: mapped.approvedDate,
                rejectedDate: mapped.rejectedDate,
                totalAmount: mapped.totalAmount,
                laborAmount: mapped.laborAmount,
                partsAmount: mapped.partsAmount,
                hasHQProduct: mapped.hasHQProduct,
                assignedTo: mapped.assignedTo,
                owner: mapped.owner,
                currencyIsoCode: mapped.currencyIsoCode,
                sfCreatedDate: mapped.sfCreatedDate,
                sfLastModified: mapped.sfLastModified,
                rawData: mapped.rawData,
              },
            }),
          ),
        );
        claimsSynced += batch.length;
        this.progress.claimsSynced = claimsSynced;
      }

      // Save to raw collection table (all Salesforce fields preserved)
      const rawSyncedAt = new Date();
      for (const batch of this.chunk(claimsRaw, DB_BATCH_SIZE)) {
        await this.prisma.$transaction(
          batch.map(r => this.prisma.sfRawClaim.upsert({
            where: { sfId: r.Id },
            update: { data: r as any, syncedAt: rawSyncedAt },
            create: { sfId: r.Id, data: r as any, syncedAt: rawSyncedAt },
          })),
        );
      }

      // Pre-build sfId → DB id map (avoids per-record findUnique later)
      const claimRows = await this.prisma.warrantyClaim.findMany({
        where: { sfId: { in: claimSfIds } },
        select: { id: true, sfId: true },
      });
      const claimIdMap = new Map(claimRows.map(r => [r.sfId, r.id]));

      // ── 2.5 ~ 5. Parallel: Dealers + HQ Claims + (Financial Orders → Billing Docs) ──
      this.setPhase('syncing_dealers', 'Syncing dealers, HQ claims, and financial orders in parallel…');

      const syncDealers = async () => {
        const dealerIds = [...dealerAccountIds];
        if (!dealerIds.length) return;
        const accountsRaw = await this.sf.getDealerAccounts(dealerIds);
        for (const batch of this.chunk(accountsRaw, DB_BATCH_SIZE)) {
          await this.prisma.$transaction(
            batch.map(r =>
              this.prisma.dealerAccount.upsert({
                where: { sfId: r.Id },
                update: { name: r.Name ?? null, phone: r.Phone ?? null, city: r.BillingCity ?? null, state: r.BillingState ?? null, rawData: r },
                create: { sfId: r.Id, name: r.Name ?? null, phone: r.Phone ?? null, city: r.BillingCity ?? null, state: r.BillingState ?? null, rawData: r },
              }),
            ),
          );
          dealersSynced += batch.length;
          this.progress.dealersSynced = dealersSynced;
        }
      };

      const syncHQClaims = async () => {
        if (!claimSfIds.length) return;
        const hqRaw = await this.sf.getHQClaimsWithParent(claimSfIds);
        const hqWithParent = hqRaw.filter(r => claimIdMap.has(r._claimSfId));
        const hqParentIds = new Set<string>();

        for (const batch of this.chunk(hqWithParent, DB_BATCH_SIZE)) {
          await this.prisma.$transaction(
            batch.map(r => {
              const claimId = claimIdMap.get(r._claimSfId)!;
              hqParentIds.add(claimId);
              return this.prisma.hQClaim.upsert({
                where: { sfId: r.Id },
                update: {
                  hqClaimNumber: r.Name,
                  status: r.Status__c ?? null,
                  judgmentResult: r.JudgmentResult__c ?? null,
                  judgedDate: r.JudgedDate__c ? new Date(r.JudgedDate__c) : null,
                  totalAmount: r._amount != null ? Number(r._amount) : null,
                  currencyIsoCode: r._currency ?? null,
                  sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
                  rawData: r,
                },
                create: {
                  sfId: r.Id,
                  claimId,
                  hqClaimNumber: r.Name,
                  status: r.Status__c ?? null,
                  judgmentResult: r.JudgmentResult__c ?? null,
                  judgedDate: r.JudgedDate__c ? new Date(r.JudgedDate__c) : null,
                  totalAmount: r._amount != null ? Number(r._amount) : null,
                  currencyIsoCode: r._currency ?? null,
                  sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
                  rawData: r,
                },
              });
            }),
          );
          hqClaimsSynced += batch.length;
          this.progress.hqSynced = hqClaimsSynced;
        }

        // Raw collection
        const hqRawAt = new Date();
        for (const batch of this.chunk(hqWithParent, DB_BATCH_SIZE)) {
          await this.prisma.$transaction(
            batch.map(r => {
              const rawData = Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_')));
              return this.prisma.sfRawHqClaim.upsert({
                where: { sfId: r.Id },
                update: { data: rawData as any, syncedAt: hqRawAt },
                create: { sfId: r.Id, data: rawData as any, syncedAt: hqRawAt },
              });
            }),
          );
        }

        if (hqParentIds.size > 0) {
          await this.prisma.warrantyClaim.updateMany({
            where: { id: { in: [...hqParentIds] } },
            data: { hasHQProduct: true },
          });
        }
      };

      const syncOrdersAndDocs = async () => {
        if (!claimSfIds.length) return;

        // Financial orders
        const ordersRaw = await this.sf.getFinancialOrders(claimSfIds);
        const ordersWithParent = ordersRaw.filter(r => claimIdMap.has(r._claimSfId));
        const orderSfIds: string[] = ordersWithParent.map(r => r.Id);

        for (const batch of this.chunk(ordersWithParent, DB_BATCH_SIZE)) {
          await this.prisma.$transaction(
            batch.map(r => {
              const claimId = claimIdMap.get(r._claimSfId)!;
              return this.prisma.financialOrder.upsert({
                where: { sfId: r.Id },
                update: {
                  orderNumber: r.Name,
                  orderType: r.Type__c ?? null,
                  status: r.Status__c ?? null,
                  amount: r._amount != null ? Number(r._amount) : null,
                  currencyIsoCode: r._currency ?? null,
                  orderDate: r.OrderDate__c ? new Date(r.OrderDate__c) : null,
                  erpStatus: r._erpStatus ?? null,
                  erpErrorMessage: r._erpErrorMessage ? String(r._erpErrorMessage).slice(0, 500) : null,
                  sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
                  rawData: r,
                },
                create: {
                  sfId: r.Id,
                  claimId,
                  orderNumber: r.Name,
                  orderType: r.Type__c ?? null,
                  status: r.Status__c ?? null,
                  amount: r._amount != null ? Number(r._amount) : null,
                  currencyIsoCode: r._currency ?? null,
                  orderDate: r.OrderDate__c ? new Date(r.OrderDate__c) : null,
                  erpStatus: r._erpStatus ?? null,
                  erpErrorMessage: r._erpErrorMessage ? String(r._erpErrorMessage).slice(0, 500) : null,
                  sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
                  rawData: r,
                },
              });
            }),
          );
          ordersSynced += batch.length;
          this.progress.ordersSynced = ordersSynced;
        }

        // Raw collection
        const orderRawAt = new Date();
        for (const batch of this.chunk(ordersWithParent, DB_BATCH_SIZE)) {
          await this.prisma.$transaction(
            batch.map(r => {
              const rawData = Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_')));
              return this.prisma.sfRawFinancialOrder.upsert({
                where: { sfId: r.Id },
                update: { data: rawData as any, syncedAt: orderRawAt },
                create: { sfId: r.Id, data: rawData as any, syncedAt: orderRawAt },
              });
            }),
          );
        }

        if (!orderSfIds.length) return;

        // Billing documents (depends on orders being synced first)
        const orderRows = await this.prisma.financialOrder.findMany({
          where: { sfId: { in: orderSfIds } },
          select: { id: true, sfId: true },
        });
        const orderIdMap = new Map(orderRows.map(r => [r.sfId, r.id]));

        const docsRaw = await this.sf.getBillingDocuments(orderSfIds);
        const docsWithParent = docsRaw.filter(r => orderIdMap.has(r._orderSfId));

        for (const batch of this.chunk(docsWithParent, DB_BATCH_SIZE)) {
          await this.prisma.$transaction(
            batch.map(r => {
              const financialOrderId = orderIdMap.get(r._orderSfId)!;
              return this.prisma.billingDocument.upsert({
                where: { sfId: r.Id },
                update: {
                  documentNumber: r.Name,
                  documentType: r.Type__c ?? null,
                  status: r.Status__c ?? null,
                  amount: r._amount != null ? Number(r._amount) : null,
                  currencyIsoCode: r._currency ?? null,
                  billingDate: r.BillingDate__c ? new Date(r.BillingDate__c) : null,
                  sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
                  rawData: r,
                },
                create: {
                  sfId: r.Id,
                  financialOrderId,
                  documentNumber: r.Name,
                  documentType: r.Type__c ?? null,
                  status: r.Status__c ?? null,
                  amount: r._amount != null ? Number(r._amount) : null,
                  currencyIsoCode: r._currency ?? null,
                  billingDate: r.BillingDate__c ? new Date(r.BillingDate__c) : null,
                  sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
                  rawData: r,
                },
              });
            }),
          );
          docsSynced += batch.length;
          this.progress.docsSynced = docsSynced;
        }

        // Raw collection
        const docRawAt = new Date();
        for (const batch of this.chunk(docsWithParent, DB_BATCH_SIZE)) {
          await this.prisma.$transaction(
            batch.map(r => {
              const rawData = Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_')));
              return this.prisma.sfRawBillingDoc.upsert({
                where: { sfId: r.Id },
                update: { data: rawData as any, syncedAt: docRawAt },
                create: { sfId: r.Id, data: rawData as any, syncedAt: docRawAt },
              });
            }),
          );
        }
      };

      // Run all three tracks in parallel
      await Promise.all([syncDealers(), syncHQClaims(), syncOrdersAndDocs()]);
      this.setPhase('syncing_docs', 'Finalizing…');

      await this.prisma.syncLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          claimsSynced,
          hqClaimsSynced,
          ordersSynced,
          docsSynced,
          dealersSynced,
          completedAt: new Date(),
        },
      });

      this.setPhase('done', 'Sync completed successfully');
      this.logger.log(
        `Sync completed: ${claimsSynced} claims, ${dealersSynced} dealers, ${hqClaimsSynced} HQ, ${ordersSynced} orders, ${docsSynced} docs`,
      );
    } catch (err) {
      this.logger.error(`Sync failed: ${err.message}`, err.stack);
      this.progress.phase = 'error';
      this.progress.phaseLabel = `Error: ${err.message}`;
      this.progress.errorMessage = err.message;
      await this.prisma.syncLog.update({
        where: { id: log.id },
        data: { status: 'error', errorMessage: err.message, completedAt: new Date() },
      });
    } finally {
      this.isSyncing = false;
    }
  }
}
