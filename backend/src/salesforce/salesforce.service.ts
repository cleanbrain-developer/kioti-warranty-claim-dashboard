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

      // If dealerLookup wasn't found by candidate names, scan describe for any reference field pointing to Account
      if (!discovered.dealerLookup) {
        const accountRefField = desc.fields.find(f =>
          f.type === 'reference' &&
          f.referenceTo?.some(r => r.toLowerCase() === 'account'),
        );
        if (accountRefField) {
          discovered.dealerLookup = accountRefField.name;
          this.logger.log(`[FieldMap] dealerLookup discovered via describe: ${accountRefField.name}`);
        }
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

  // ── Relationship Field Discovery ────────────────────────

  private relationshipCache = new Map<string, string | null>();
  private erpFieldCache = new Map<string, { status: string | null; error: string | null }>();

  /**
   * Uses describe API to find the lookup field on childObject that references parentObject.
   * Result is cached in memory so describe is only called once per object pair.
   */
  async discoverRelationshipField(childObject: string, parentObject: string): Promise<string | null> {
    const cacheKey = `${childObject}→${parentObject}`;
    if (this.relationshipCache.has(cacheKey)) return this.relationshipCache.get(cacheKey);

    try {
      const desc = await this.describe(childObject);
      const refField = desc.fields.find(f =>
        f.type === 'reference' &&
        f.referenceTo?.some(r => r.toLowerCase() === parentObject.toLowerCase()),
      );
      const result = refField?.name || null;
      this.relationshipCache.set(cacheKey, result);
      if (result) {
        this.logger.log(`[Describe] ${childObject} → ${parentObject} via: ${result}`);
      } else {
        this.logger.warn(`[Describe] No reference field found: ${childObject} → ${parentObject}`);
      }
      return result;
    } catch (err) {
      this.logger.warn(`[Describe] Failed to describe ${childObject}: ${err.message}`);
      this.relationshipCache.set(cacheKey, null);
      return null;
    }
  }

  /**
   * Tries each detail field set against the object to find one that doesn't throw.
   * Returns the first working set (or '' if none include extra fields).
   */
  private async discoverWorkingFields(
    objectName: string,
    fixedFields: string[],
    fieldSetCandidates: string[],
  ): Promise<string> {
    for (const fields of fieldSetCandidates) {
      try {
        const allFields = [...fixedFields, ...(fields ? [fields] : [])].join(', ');
        await this.query(`SELECT ${allFields} FROM ${objectName} LIMIT 1`);
        return fields;
      } catch {
        // Try next
      }
    }
    return '';
  }

  async discoverERPFields(objectName: string): Promise<{ status: string | null; error: string | null }> {
    if (this.erpFieldCache.has(objectName)) return this.erpFieldCache.get(objectName);
    try {
      const desc = await this.describe(objectName);
      const names = desc.fields.map(f => f.name);
      const lower = names.map(n => n.toLowerCase());

      const findField = (patterns: string[]): string | null => {
        for (const p of patterns) {
          const idx = lower.indexOf(p.toLowerCase());
          if (idx !== -1) return names[idx];
        }
        return null;
      };

      const result = {
        status: findField(['ERPStatus__c', 'ERP_Status__c', 'SendStatus__c', 'ERPSendStatus__c', 'EDIStatus__c', 'IntegrationStatus__c', 'ERPTransferStatus__c']),
        error:  findField(['ERPErrorMessage__c', 'ERP_Error_Message__c', 'SendErrorMessage__c', 'ERPError__c', 'EDIErrorMessage__c', 'IntegrationErrorMessage__c']),
      };
      this.erpFieldCache.set(objectName, result);
      if (result.status) this.logger.log(`[ERP] ${objectName}: status=${result.status}, error=${result.error}`);
      return result;
    } catch {
      const result = { status: null, error: null };
      this.erpFieldCache.set(objectName, result);
      return result;
    }
  }

  async getDealerAccounts(accountIds: string[]): Promise<any[]> {
    if (!accountIds.length) return [];
    const all: any[] = [];
    for (let i = 0; i < accountIds.length; i += 200) {
      const batch = accountIds.slice(i, i + 200);
      const ids = batch.map(id => `'${id}'`).join(', ');
      try {
        const rows = await this.query(`SELECT Id, Name, Phone, BillingStreet, BillingCity, BillingState, BillingPostalCode FROM Account WHERE Id IN (${ids})`);
        all.push(...rows);
      } catch {
        try {
          const rows = await this.query(`SELECT Id, Name FROM Account WHERE Id IN (${ids})`);
          all.push(...rows);
        } catch (err) {
          this.logger.warn(`getDealerAccounts batch failed: ${err.message}`);
        }
      }
    }
    return all;
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

    // Step 1: discover the lookup field (describe-based, cached)
    let parentField = await this.discoverRelationshipField(this.hqClaimObject, this.claimObject);
    if (!parentField) {
      // Fallback: try known candidates with a probe query
      for (const candidate of ['Claim__c', 'WarrantyClaim__c', 'ClaimId__c', 'ParentClaim__c']) {
        try {
          await this.query(`SELECT Id, ${candidate} FROM ${this.hqClaimObject} LIMIT 1`);
          parentField = candidate;
          this.logger.log(`[HQClaim] Fallback parent field: ${candidate}`);
          break;
        } catch { /* try next */ }
      }
    }
    if (!parentField) {
      this.logger.warn('[HQClaim] Cannot determine parent field. Skipping HQ Claim sync.');
      return [];
    }

    // Step 2: discover available detail fields (once, before batches)
    const workingDetails = await this.discoverWorkingFields(
      this.hqClaimObject,
      ['Id', 'Name', parentField, 'CreatedDate'],
      ['Status__c, JudgmentResult__c, JudgedDate__c, TotalAmount__c', 'Status__c, TotalAmount__c', ''],
    );

    const allFields = ['Id', 'Name', parentField, 'CreatedDate', ...(workingDetails ? [workingDetails] : [])].join(', ');
    const batchSize = 100;
    const results: any[] = [];

    // Step 3: batch-query all claim IDs
    for (let i = 0; i < claimSfIds.length; i += batchSize) {
      const ids = claimSfIds.slice(i, i + batchSize).map(id => `'${id}'`).join(', ');
      try {
        const rows = await this.query(`SELECT ${allFields} FROM ${this.hqClaimObject} WHERE ${parentField} IN (${ids})`);
        results.push(...rows.map(r => ({ ...r, _claimSfId: r[parentField] })));
      } catch (err) {
        this.logger.warn(`[HQClaim] Batch ${i}–${i + batchSize} failed: ${err.message}`);
      }
    }
    return results;
  }

  async getFinancialOrders(claimSfIds: string[]): Promise<any[]> {
    if (!claimSfIds.length) return [];

    // Step 1: discover the lookup field from FinancialOrder__c → Claim__c
    let parentField = await this.discoverRelationshipField(this.financialOrderObject, this.claimObject);
    if (!parentField) {
      // Fallback: probe candidates (exclude self-reference FinancialOrder__c)
      for (const candidate of ['Claim__c', 'WarrantyClaim__c', 'ClaimId__c', 'ServiceClaim__c']) {
        try {
          await this.query(`SELECT Id, ${candidate} FROM ${this.financialOrderObject} LIMIT 1`);
          parentField = candidate;
          this.logger.log(`[FinancialOrder] Fallback parent field: ${candidate}`);
          break;
        } catch { /* try next */ }
      }
    }
    if (!parentField) {
      this.logger.warn('[FinancialOrder] Cannot determine parent field. Skipping Financial Order sync.');
      return [];
    }

    // Step 2: discover available detail fields (once) + ERP fields
    const erpFields = await this.discoverERPFields(this.financialOrderObject);
    const erpStr = [erpFields.status, erpFields.error].filter(Boolean).join(', ');

    const workingDetails = await this.discoverWorkingFields(
      this.financialOrderObject,
      ['Id', 'Name', parentField, 'CreatedDate'],
      ['Type__c, Status__c, Amount__c, OrderDate__c', 'Status__c, Amount__c', ''],
    );

    const detailParts = [workingDetails, erpStr].filter(Boolean).join(', ');
    const allFields = ['Id', 'Name', parentField, 'CreatedDate', ...(detailParts ? [detailParts] : [])].join(', ');
    const batchSize = 100;
    const results: any[] = [];

    // Step 3: batch-query all claim IDs
    for (let i = 0; i < claimSfIds.length; i += batchSize) {
      const ids = claimSfIds.slice(i, i + batchSize).map(id => `'${id}'`).join(', ');
      try {
        const rows = await this.query(`SELECT ${allFields} FROM ${this.financialOrderObject} WHERE ${parentField} IN (${ids})`);
        results.push(...rows.map(r => ({
          ...r,
          _claimSfId: r[parentField],
          _erpStatus: erpFields.status ? (r[erpFields.status] ?? null) : null,
          _erpErrorMessage: erpFields.error ? (r[erpFields.error] ?? null) : null,
        })));
      } catch (err) {
        this.logger.warn(`[FinancialOrder] Batch ${i}–${i + batchSize} failed: ${err.message}`);
      }
    }
    return results;
  }

  async getBillingDocuments(orderSfIds: string[]): Promise<any[]> {
    if (!orderSfIds.length) return [];

    // Step 1: discover lookup from BillingDocument__c → FinancialOrder__c
    let parentField = await this.discoverRelationshipField(this.billingDocObject, this.financialOrderObject);
    if (!parentField) {
      for (const candidate of ['FinancialOrder__c', 'Order__c', 'OrderId__c']) {
        try {
          await this.query(`SELECT Id, ${candidate} FROM ${this.billingDocObject} LIMIT 1`);
          parentField = candidate;
          this.logger.log(`[BillingDoc] Fallback parent field: ${candidate}`);
          break;
        } catch { /* try next */ }
      }
    }
    if (!parentField) {
      this.logger.warn('[BillingDoc] Cannot determine parent field. Skipping Billing Document sync.');
      return [];
    }

    // Step 2: discover available detail fields (once)
    const workingDetails = await this.discoverWorkingFields(
      this.billingDocObject,
      ['Id', 'Name', parentField, 'CreatedDate'],
      ['Type__c, Status__c, Amount__c, BillingDate__c', 'Status__c, Amount__c', ''],
    );

    const allFields = ['Id', 'Name', parentField, 'CreatedDate', ...(workingDetails ? [workingDetails] : [])].join(', ');
    const batchSize = 100;
    const results: any[] = [];

    // Step 3: batch-query
    for (let i = 0; i < orderSfIds.length; i += batchSize) {
      const ids = orderSfIds.slice(i, i + batchSize).map(id => `'${id}'`).join(', ');
      try {
        const rows = await this.query(`SELECT ${allFields} FROM ${this.billingDocObject} WHERE ${parentField} IN (${ids})`);
        results.push(...rows.map(r => ({ ...r, _orderSfId: r[parentField] })));
      } catch (err) {
        this.logger.warn(`[BillingDoc] Batch ${i}–${i + batchSize} failed: ${err.message}`);
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
