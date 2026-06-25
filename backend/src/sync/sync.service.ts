import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SalesforceService } from '../salesforce/salesforce.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private isSyncing = false;

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

  async performSync(syncType: 'scheduled' | 'manual') {
    if (this.isSyncing) {
      this.logger.warn('Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;
    const startedAt = new Date();
    const log = await this.prisma.syncLog.create({
      data: { syncType, status: 'running', startedAt },
    });

    let claimsSynced = 0;
    let hqClaimsSynced = 0;
    let ordersSynced = 0;
    let docsSynced = 0;

    try {
      // Determine incremental sync date
      const lastSuccessLog = await this.prisma.syncLog.findFirst({
        where: { status: 'success', syncType: 'scheduled' },
        orderBy: { completedAt: 'desc' },
      });
      const lastSyncDate = lastSuccessLog?.completedAt || null;

      this.logger.log(`Syncing claims ${lastSyncDate ? `since ${lastSyncDate.toISOString()}` : '(full sync)'}`);

      // ── 1. Sync Warranty Claims ───────────────────────
      const claimsRaw = await this.sf.getWarrantyClaims(lastSyncDate);
      this.logger.log(`Fetched ${claimsRaw.length} claims from Salesforce`);

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
            sfCreatedDate: mapped.sfCreatedDate,
            sfLastModified: mapped.sfLastModified,
            rawData: mapped.rawData,
          },
        });
        claimsSynced++;
      }

      // ── 2. Sync HQ Claims ────────────────────────────
      if (claimSfIds.length) {
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
              status: r.Status__c,
              judgmentResult: r.JudgmentResult__c,
              judgedDate: r.JudgedDate__c ? new Date(r.JudgedDate__c) : null,
              totalAmount: r.TotalAmount__c ? Number(r.TotalAmount__c) : null,
              sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
              rawData: r,
            },
            create: {
              sfId: r.Id,
              claimId: parentClaim.id,
              hqClaimNumber: r.Name,
              status: r.Status__c,
              judgmentResult: r.JudgmentResult__c,
              judgedDate: r.JudgedDate__c ? new Date(r.JudgedDate__c) : null,
              totalAmount: r.TotalAmount__c ? Number(r.TotalAmount__c) : null,
              sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
              rawData: r,
            },
          });

          // Update parent claim's HQ product flag
          await this.prisma.warrantyClaim.update({
            where: { id: parentClaim.id },
            data: { hasHQProduct: true },
          });

          hqClaimsSynced++;
        }
      }

      // ── 3. Sync Financial Orders ──────────────────────
      if (claimSfIds.length) {
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
              orderType: r.Type__c,
              status: r.Status__c,
              amount: r.Amount__c ? Number(r.Amount__c) : null,
              orderDate: r.OrderDate__c ? new Date(r.OrderDate__c) : null,
              sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
              rawData: r,
            },
            create: {
              sfId: r.Id,
              claimId: parentClaim.id,
              orderNumber: r.Name,
              orderType: r.Type__c,
              status: r.Status__c,
              amount: r.Amount__c ? Number(r.Amount__c) : null,
              orderDate: r.OrderDate__c ? new Date(r.OrderDate__c) : null,
              sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
              rawData: r,
            },
          });
          orderSfIds.push(r.Id);
          ordersSynced++;
        }

        // ── 4. Sync Billing Documents ───────────────────
        if (orderSfIds.length) {
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
                documentType: r.Type__c,
                status: r.Status__c,
                amount: r.Amount__c ? Number(r.Amount__c) : null,
                billingDate: r.BillingDate__c ? new Date(r.BillingDate__c) : null,
                sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
                rawData: r,
              },
              create: {
                sfId: r.Id,
                financialOrderId: parentOrder.id,
                documentNumber: r.Name,
                documentType: r.Type__c,
                status: r.Status__c,
                amount: r.Amount__c ? Number(r.Amount__c) : null,
                billingDate: r.BillingDate__c ? new Date(r.BillingDate__c) : null,
                sfCreatedDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
                rawData: r,
              },
            });
            docsSynced++;
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

      this.logger.log(
        `Sync completed: ${claimsSynced} claims, ${hqClaimsSynced} HQ claims, ${ordersSynced} orders, ${docsSynced} billing docs`,
      );
    } catch (err) {
      this.logger.error(`Sync failed: ${err.message}`, err.stack);
      await this.prisma.syncLog.update({
        where: { id: log.id },
        data: { status: 'error', errorMessage: err.message, completedAt: new Date() },
      });
    } finally {
      this.isSyncing = false;
    }
  }
}
