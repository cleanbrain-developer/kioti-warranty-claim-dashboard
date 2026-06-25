import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SalesforceService } from '../salesforce/salesforce.service';

export interface SyncProgress {
  phase: 'idle' | 'fetching_claims' | 'syncing_claims' | 'syncing_hq' | 'syncing_orders' | 'syncing_docs' | 'done' | 'error';
  phaseLabel: string;
  claimsFetched: number;
  claimsSynced: number;
  claimsTotal: number;
  hqSynced: number;
  ordersSynced: number;
  docsSynced: number;
  elapsedSeconds: number;
  startedAt: string | null;
  errorMessage: string | null;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private isSyncing = false;

  private progress: SyncProgress = {
    phase: 'idle',
    phaseLabel: '',
    claimsFetched: 0,
    claimsSynced: 0,
    claimsTotal: 0,
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
  ) {}

  @Cron('0 1 * * *')
  async scheduledSync() {
    this.logger.log('Starting scheduled sync at 1:00 AM');
    await this.performSync('scheduled');
  }

  async manualSync(password: string): Promise<{ success: boolean; message: string }> {
    const expected = this.config.get('SYNC_PASSWORD', 'kioti');
    if (password !== expected) {
      return { success: false, message: 'Invalid password' };
    }
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress' };
    }
    this.performSync('manual').catch(err => this.logger.error('Manual sync failed', err));
    return { success: true, message: 'Sync started' };
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

  async getStatus(): Promise<{
    isSyncing: boolean;
    lastSync: any;
    recentLogs: any[];
  }> {
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

  async performSync(syncType: 'scheduled' | 'manual') {
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
    let hqClaimsSynced = 0;
    let ordersSynced = 0;
    let docsSynced = 0;

    try {
      // Determine incremental sync date (any successful sync type)
      const lastSuccessLog = await this.prisma.syncLog.findFirst({
        where: { status: 'success' },
        orderBy: { completedAt: 'desc' },
      });
      const lastSyncDate = lastSuccessLog?.completedAt || null;

      this.logger.log(`Syncing claims ${lastSyncDate ? `since ${lastSyncDate.toISOString()}` : '(full sync)'}`);

      // ── 1. Fetch Warranty Claims from Salesforce ──────────
      this.setPhase('fetching_claims', lastSyncDate
        ? `Fetching claims modified since ${lastSyncDate.toLocaleDateString('en-US')}…`
        : 'Fetching all warranty claims from Salesforce…');

      const claimsRaw = await this.sf.getWarrantyClaims(lastSyncDate);
      this.progress.claimsFetched = claimsRaw.length;
      this.progress.claimsTotal = claimsRaw.length;
      this.logger.log(`Fetched ${claimsRaw.length} claims from Salesforce`);

      // ── 2. Sync Claims to DB ──────────────────────────────
      this.setPhase('syncing_claims', `Syncing ${claimsRaw.length.toLocaleString()} claims to database…`);

      const claimSfIds: string[] = [];

      for (const raw of claimsRaw) {
        const mapped = this.sf.mapClaim(raw);
        claimSfIds.push(raw.Id);

        await this.prisma.warrantyClaim.upsert({
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
            sfCreatedDate: mapped.sfCreatedDate,
            sfLastModified: mapped.sfLastModified,
            rawData: mapped.rawData,
          },
        });
        claimsSynced++;
        this.progress.claimsSynced = claimsSynced;
      }

      // ── 3. Sync HQ Claims ────────────────────────────────
      if (claimSfIds.length) {
        this.setPhase('syncing_hq', `Syncing HQ Claims for ${claimSfIds.length.toLocaleString()} claims…`);

        const hqRaw = await this.sf.getHQClaimsWithParent(claimSfIds);
        for (const r of hqRaw) {
          const parentClaim = await this.prisma.warrantyClaim.findUnique({
            where: { sfId: r._claimSfId },
          });
          if (!parentClaim) continue;

          await this.prisma.hQClaim.upsert({
            where: { sfId: r.Id },
            update: {
              hqClaimNumber: r.Name,
              status: r.Status__c ?? null,
              judgmentResult: r.JudgmentResult__c ?? null,
              judgedDate: r.JudgedDate__c ? new Date(r.JudgedDate__c) : null,
              totalAmount: r.TotalAmount__c ? Number(r.TotalAmount__c) : null,
              sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
              rawData: r,
            },
            create: {
              sfId: r.Id,
              claimId: parentClaim.id,
              hqClaimNumber: r.Name,
              status: r.Status__c ?? null,
              judgmentResult: r.JudgmentResult__c ?? null,
              judgedDate: r.JudgedDate__c ? new Date(r.JudgedDate__c) : null,
              totalAmount: r.TotalAmount__c ? Number(r.TotalAmount__c) : null,
              sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
              rawData: r,
            },
          });

          await this.prisma.warrantyClaim.update({
            where: { id: parentClaim.id },
            data: { hasHQProduct: true },
          });

          hqClaimsSynced++;
          this.progress.hqSynced = hqClaimsSynced;
        }
      }

      // ── 4. Sync Financial Orders ─────────────────────────
      if (claimSfIds.length) {
        this.setPhase('syncing_orders', 'Syncing Financial Orders…');

        const ordersRaw = await this.sf.getFinancialOrders(claimSfIds);
        const orderSfIds: string[] = [];

        for (const r of ordersRaw) {
          const parentClaim = await this.prisma.warrantyClaim.findUnique({
            where: { sfId: r._claimSfId },
          });
          if (!parentClaim) continue;

          await this.prisma.financialOrder.upsert({
            where: { sfId: r.Id },
            update: {
              orderNumber: r.Name,
              orderType: r.Type__c ?? null,
              status: r.Status__c ?? null,
              amount: r.Amount__c ? Number(r.Amount__c) : null,
              orderDate: r.OrderDate__c ? new Date(r.OrderDate__c) : null,
              sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
              rawData: r,
            },
            create: {
              sfId: r.Id,
              claimId: parentClaim.id,
              orderNumber: r.Name,
              orderType: r.Type__c ?? null,
              status: r.Status__c ?? null,
              amount: r.Amount__c ? Number(r.Amount__c) : null,
              orderDate: r.OrderDate__c ? new Date(r.OrderDate__c) : null,
              sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
              rawData: r,
            },
          });
          orderSfIds.push(r.Id);
          ordersSynced++;
          this.progress.ordersSynced = ordersSynced;
        }

        // ── 5. Sync Billing Documents ──────────────────────
        if (orderSfIds.length) {
          this.setPhase('syncing_docs', `Syncing Billing Documents for ${orderSfIds.length} orders…`);

          const docsRaw = await this.sf.getBillingDocuments(orderSfIds);
          for (const r of docsRaw) {
            const parentOrder = await this.prisma.financialOrder.findUnique({
              where: { sfId: r._orderSfId },
            });
            if (!parentOrder) continue;

            await this.prisma.billingDocument.upsert({
              where: { sfId: r.Id },
              update: {
                documentNumber: r.Name,
                documentType: r.Type__c ?? null,
                status: r.Status__c ?? null,
                amount: r.Amount__c ? Number(r.Amount__c) : null,
                billingDate: r.BillingDate__c ? new Date(r.BillingDate__c) : null,
                sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
                rawData: r,
              },
              create: {
                sfId: r.Id,
                financialOrderId: parentOrder.id,
                documentNumber: r.Name,
                documentType: r.Type__c ?? null,
                status: r.Status__c ?? null,
                amount: r.Amount__c ? Number(r.Amount__c) : null,
                billingDate: r.BillingDate__c ? new Date(r.BillingDate__c) : null,
                sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
                rawData: r,
              },
            });
            docsSynced++;
            this.progress.docsSynced = docsSynced;
          }
        }
      }

      await this.prisma.syncLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          claimsSynced,
          hqClaimsSynced,
          ordersSynced,
          docsSynced,
          completedAt: new Date(),
        },
      });

      this.setPhase('done', 'Sync completed successfully');
      this.logger.log(
        `Sync completed: ${claimsSynced} claims, ${hqClaimsSynced} HQ claims, ${ordersSynced} orders, ${docsSynced} billing docs`,
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
