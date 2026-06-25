import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../prisma/prisma.service';

interface TokenResponse {
  access_token: string;
  instance_url: string;
  token_type: string;
  issued_at: string;
}

interface SFDescribeField {
  name: string;
  label: string;
  type: string;
  referenceTo?: string[];
}

interface SFQueryResult<T> {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
}

@Injectable()
export class SalesforceService {
  private readonly logger = new Logger(SalesforceService.name);
  private accessToken: string | null = null;
  private instanceUrl: string;
  private tokenExpiry: Date | null = null;
  private http: AxiosInstance;

  // Discovered field names cached in memory
  private claimFieldMap: Record<string, string> = {};
  private fieldMapLoaded = false;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.instanceUrl = this.config.get('SF_DOMAIN');
  }

  private get apiVersion() {
    return this.config.get('SF_API_VERSION', 'v62.0');
  }

  private get claimObject() {
    return this.config.get('SF_CLAIM_OBJECT', 'Claim__c');
  }

  private get hqClaimObject() {
    return this.config.get('SF_HQCLAIM_OBJECT', 'HQClaim__c');
  }

  private get financialOrderObject() {
    return this.config.get('SF_FINANCIAL_ORDER_OBJECT', 'FinancialOrder__c');
  }

  private get billingDocObject() {
    return this.config.get('SF_BILLING_DOCUMENT_OBJECT', 'BillingDocument__c');
  }

  private get claimTypeField() {
    return this.config.get('SF_CLAIM_TYPE_FIELD', 'ClaimType__c');
  }

  private get claimTypeValue() {
    return this.config.get('SF_CLAIM_TYPE_VALUE', 'Warranty Repair');
  }

  async authenticate(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) return;

    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: this.config.get('SF_CLIENT_ID'),
      client_secret: this.config.get('SF_CLIENT_SECRET'),
      username: this.config.get('SF_USERNAME'),
      password: this.config.get('SF_PASSWORD'),
    });

    const res = await axios.post<TokenResponse>(
      `${this.instanceUrl}/services/oauth2/token`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    this.accessToken = res.data.access_token;
    this.instanceUrl = res.data.instance_url;
    this.tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    this.http = axios.create({
      baseURL: `${this.instanceUrl}/services/data/${this.apiVersion}`,
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    this.logger.log('Salesforce authenticated successfully');
  }

  async describe(objectName: string): Promise<{ fields: SFDescribeField[] }> {
    await this.authenticate();
    const res = await this.http.get(`/sobjects/${objectName}/describe`);
    return res.data;
  }

  async query<T = any>(soql: string): Promise<T[]> {
    await this.authenticate();
    const results: T[] = [];
    let url = `/query?q=${encodeURIComponent(soql)}`;

    while (url) {
      const res = await this.http.get<SFQueryResult<T>>(url);
      results.push(...res.data.records);
      url = res.data.nextRecordsUrl
        ? res.data.nextRecordsUrl.replace(/.*\/services\/data\/[^/]+/, '')
        : null;
    }

    return results;
  }

  // ── Field Discovery ─────────────────────────────────────

  private findField(availableFields: string[], candidates: string[]): string | null {
    const lower = availableFields.map(f => f.toLowerCase());
    for (const c of candidates) {
      const idx = lower.indexOf(c.toLowerCase());
      if (idx !== -1) return availableFields[idx];
    }
    return null;
  }

  async loadFieldMapping(): Promise<void> {
    if (this.fieldMapLoaded) return;

    // Try loading from DB first
    const saved = await this.prisma.fieldMapping.findMany({
      where: { objectName: this.claimObject },
    });

    if (saved.length > 0) {
      for (const m of saved) this.claimFieldMap[m.fieldKey] = m.fieldName;
      this.fieldMapLoaded = true;
      this.logger.log('Loaded field mapping from DB');
      return;
    }

    // Discover from Salesforce
    try {
      const desc = await this.describe(this.claimObject);
      const fieldNames = desc.fields.map(f => f.name);

      const mapping: Record<string, string[]> = {
        status: ['Status__c', 'ClaimStatus__c', 'Stage__c', 'ApprovalStatus__c'],
        dealerLookup: ['Dealer__c', 'Account__c', 'DealerAccount__c', 'AccountId'],
        dealerName: ['DealerName__c', 'AccountName__c'],
        model: ['Model__c', 'ModelName__c', 'ProductModel__c', 'UnitModel__c', 'EquipmentModel__c'],
        serialNumber: ['SerialNumber__c', 'VIN__c', 'UnitSerial__c', 'MachineSerialNumber__c', 'UnitSerialNumber__c'],
        repairDate: ['RepairDate__c', 'ServiceDate__c', 'FailureDate__c', 'IncidentDate__c', 'WorkDate__c'],
        submittedDate: ['SubmittedDate__c', 'SubmissionDate__c', 'ClaimDate__c'],
        approvedDate: ['ApprovedDate__c', 'ApprovalDate__c', 'ApprovedOn__c'],
        rejectedDate: ['RejectedDate__c', 'DeniedDate__c'],
        totalAmount: ['TotalAmount__c', 'ClaimAmount__c', 'TotalClaimAmount__c', 'Amount__c'],
        laborAmount: ['LaborAmount__c', 'LaborCost__c', 'TotalLabor__c'],
        partsAmount: ['PartsAmount__c', 'PartAmount__c', 'PartsCost__c', 'TotalParts__c'],
        hasHQProduct: ['HasHQProduct__c', 'HQProductIncluded__c', 'IsHQProduct__c', 'ContainsHQParts__c'],
        assignedTo: ['PersonInCharge__c', 'AssignedTo__c', 'AssignedUser__c', 'HandlerName__c', 'ClaimHandler__c'],
      };

      const discovered: Record<string, string> = {};
      for (const [key, candidates] of Object.entries(mapping)) {
        const found = this.findField(fieldNames, candidates);
        if (found) discovered[key] = found;
      }

      this.claimFieldMap = discovered;
      this.fieldMapLoaded = true;

      // Persist to DB
      for (const [key, name] of Object.entries(discovered)) {
        await this.prisma.fieldMapping.upsert({
          where: { objectName_fieldKey: { objectName: this.claimObject, fieldKey: key } },
          update: { fieldName: name },
          create: { objectName: this.claimObject, fieldKey: key, fieldName: name },
        });
      }

      this.logger.log(`Discovered ${Object.keys(discovered).length} fields for ${this.claimObject}`);
    } catch (err) {
      this.logger.warn(`Field discovery failed: ${err.message}. Will use raw data.`);
      this.fieldMapLoaded = true;
    }
  }

  getClaimField(key: string): string | null {
    return this.claimFieldMap[key] || null;
  }

  // ── Claim Queries ───────────────────────────────────────

  async getWarrantyClaims(lastModifiedDate?: Date): Promise<any[]> {
    await this.loadFieldMapping();

    const f = this.claimFieldMap;
    const extraFields = Object.values(f)
      .filter(v => v && !v.includes('.'))
      .filter((v, i, a) => a.indexOf(v) === i);

    // Add dealer relationship field so we can resolve dealer name
    const dealerRelFields: string[] = [];
    if (f.dealerLookup) {
      if (f.dealerLookup === 'AccountId') {
        dealerRelFields.push('Account.Name');
      } else if (f.dealerLookup.endsWith('__c')) {
        dealerRelFields.push(`${f.dealerLookup.replace('__c', '__r')}.Name`);
      }
    }

    const baseFields = ['Id', 'Name', 'CreatedDate', 'LastModifiedDate', this.claimTypeField, 'Owner.Name'];
    const allFields = [...new Set([...baseFields, ...extraFields, ...dealerRelFields])].join(', ');

    let soql = `SELECT ${allFields} FROM ${this.claimObject} WHERE ${this.claimTypeField} = '${this.claimTypeValue}'`;
    if (lastModifiedDate) {
      soql += ` AND LastModifiedDate >= ${lastModifiedDate.toISOString()}`;
    }
    soql += ' ORDER BY LastModifiedDate ASC';

    return this.query(soql);
  }

  async getHQClaims(claimSfIds: string[]): Promise<any[]> {
    if (!claimSfIds.length) return [];
    const batchSize = 100;
    const results: any[] = [];

    for (let i = 0; i < claimSfIds.length; i += batchSize) {
      const batch = claimSfIds.slice(i, i + batchSize);
      const ids = batch.map(id => `'${id}'`).join(', ');
      try {
        const soql = `SELECT Id, Name, Status__c, JudgmentResult__c, JudgedDate__c, TotalAmount__c, CreatedDate FROM ${this.hqClaimObject} WHERE Claim__c IN (${ids})`;
        const rows = await this.query(soql);
        results.push(...rows);
      } catch (err) {
        this.logger.warn(`HQ Claim query failed: ${err.message}`);
      }
    }
    return results;
  }

  async getHQClaimsWithParent(claimSfIds: string[]): Promise<any[]> {
    if (!claimSfIds.length) return [];
    const batchSize = 100;
    const results: any[] = [];

    const parentFields = ['Claim__c', 'ClaimId__c', 'ParentClaim__c', 'WarrantyClaim__c'];
    // Detail fields to try (degrade gracefully if some don't exist)
    const detailFieldSets = [
      'Status__c, JudgmentResult__c, JudgedDate__c, TotalAmount__c',
      'Status__c, TotalAmount__c',
      '',
    ];

    for (let i = 0; i < claimSfIds.length; i += batchSize) {
      const batch = claimSfIds.slice(i, i + batchSize);
      const ids = batch.map(id => `'${id}'`).join(', ');

      let synced = false;
      for (const parentField of parentFields) {
        if (synced) break;
        for (const details of detailFieldSets) {
          try {
            const fields = ['Id', 'Name', parentField, 'CreatedDate', ...(details ? [details] : [])].join(', ');
            const soql = `SELECT ${fields} FROM ${this.hqClaimObject} WHERE ${parentField} IN (${ids})`;
            const rows = await this.query(soql);
            results.push(...rows.map(r => ({ ...r, _claimSfId: r[parentField] })));
            synced = true;
            break;
          } catch {
            // Try next field set / parent field
          }
        }
      }
    }
    return results;
  }

  async getFinancialOrders(claimSfIds: string[]): Promise<any[]> {
    if (!claimSfIds.length) return [];
    const batchSize = 100;
    const results: any[] = [];

    const parentFields = ['Claim__c', 'FinancialOrder__c', 'ClaimId__c', 'WarrantyClaim__c'];
    const detailFieldSets = [
      'Type__c, Status__c, Amount__c, OrderDate__c',
      'Status__c, Amount__c',
      '',
    ];

    for (let i = 0; i < claimSfIds.length; i += batchSize) {
      const batch = claimSfIds.slice(i, i + batchSize);
      const ids = batch.map(id => `'${id}'`).join(', ');

      let synced = false;
      for (const parentField of parentFields) {
        if (synced) break;
        for (const details of detailFieldSets) {
          try {
            const fields = ['Id', 'Name', parentField, 'CreatedDate', ...(details ? [details] : [])].join(', ');
            const soql = `SELECT ${fields} FROM ${this.financialOrderObject} WHERE ${parentField} IN (${ids})`;
            const rows = await this.query(soql);
            results.push(...rows.map(r => ({ ...r, _claimSfId: r[parentField] })));
            synced = true;
            break;
          } catch {
            // Try next
          }
        }
      }
    }
    return results;
  }

  async getBillingDocuments(orderSfIds: string[]): Promise<any[]> {
    if (!orderSfIds.length) return [];
    const batchSize = 100;
    const results: any[] = [];

    const parentFields = ['FinancialOrder__c', 'OrderId__c', 'Order__c'];

    for (let i = 0; i < orderSfIds.length; i += batchSize) {
      const batch = orderSfIds.slice(i, i + batchSize);
      const ids = batch.map(id => `'${id}'`).join(', ');

      for (const parentField of parentFields) {
        try {
          const soql = `SELECT Id, Name, ${parentField}, Type__c, Status__c, Amount__c, BillingDate__c, CreatedDate FROM ${this.billingDocObject} WHERE ${parentField} IN (${ids})`;
          const rows = await this.query(soql);
          results.push(...rows.map(r => ({ ...r, _orderSfId: r[parentField] })));
          break;
        } catch {
          // Try next
        }
      }
    }
    return results;
  }

  mapClaim(record: any): {
    id: string; sfId: string; claimNumber: string; claimType: string; status: string;
    dealerAccountId: string; dealerName: string; modelName: string; serialNumber: string;
    repairDate: Date; submittedDate: Date; approvedDate: Date; rejectedDate: Date;
    totalAmount: number; laborAmount: number; partsAmount: number; hasHQProduct: boolean;
    assignedTo: string; sfCreatedDate: Date; sfLastModified: Date; rawData: any;
  } {
    const f = this.claimFieldMap;

    // Assignee: custom field first, then Owner.Name from relationship
    const assignedTo = (f.assignedTo ? record[f.assignedTo] : null)
      || record.Owner?.Name
      || null;

    // Dealer name: explicit field, or relationship object, or AccountId relationship
    let dealerName: string | null = null;
    if (f.dealerName && record[f.dealerName]) {
      dealerName = record[f.dealerName];
    } else if (f.dealerLookup) {
      if (f.dealerLookup === 'AccountId') {
        dealerName = record.Account?.Name || null;
      } else if (f.dealerLookup.endsWith('__c')) {
        const relObj = record[f.dealerLookup.replace('__c', '__r')];
        dealerName = relObj?.Name || null;
      }
    }

    return {
      id: record.Id,
      sfId: record.Id,
      claimNumber: record.Name,
      claimType: record[this.claimTypeField],
      status: f.status ? record[f.status] : null,
      dealerAccountId: f.dealerLookup ? record[f.dealerLookup] : null,
      dealerName,
      modelName: f.model ? record[f.model] : null,
      serialNumber: f.serialNumber ? record[f.serialNumber] : null,
      repairDate: f.repairDate ? (record[f.repairDate] ? new Date(record[f.repairDate]) : null) : null,
      submittedDate: f.submittedDate ? (record[f.submittedDate] ? new Date(record[f.submittedDate]) : null) : (record.CreatedDate ? new Date(record.CreatedDate) : null),
      approvedDate: f.approvedDate ? (record[f.approvedDate] ? new Date(record[f.approvedDate]) : null) : null,
      rejectedDate: f.rejectedDate ? (record[f.rejectedDate] ? new Date(record[f.rejectedDate]) : null) : null,
      totalAmount: f.totalAmount ? (record[f.totalAmount] ? Number(record[f.totalAmount]) : null) : null,
      laborAmount: f.laborAmount ? (record[f.laborAmount] ? Number(record[f.laborAmount]) : null) : null,
      partsAmount: f.partsAmount ? (record[f.partsAmount] ? Number(record[f.partsAmount]) : null) : null,
      hasHQProduct: f.hasHQProduct ? Boolean(record[f.hasHQProduct]) : false,
      assignedTo,
      sfCreatedDate: record.CreatedDate ? new Date(record.CreatedDate) : null,
      sfLastModified: record.LastModifiedDate ? new Date(record.LastModifiedDate) : null,
      rawData: record,
    };
  }

  resetFieldMapping() {
    this.claimFieldMap = {};
    this.fieldMapLoaded = false;
  }
}
