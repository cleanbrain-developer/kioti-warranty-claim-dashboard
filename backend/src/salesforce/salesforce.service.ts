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

  // "Repair Date" should reflect when the unit was actually fixed, not when the
  // problem was reported — prioritize "Fixed Date"-style names. FailureDate__c /
  // IncidentDate__c describe when the unit broke, which belongs under failureDate instead.
  private readonly REPAIR_DATE_CANDIDATES = ['FixedDate__c', 'Fixed_Date__c', 'RepairDate__c', 'RepairCompletedDate__c', 'ServiceDate__c', 'WorkDate__c', 'CompletionDate__c'];
  private readonly FAILURE_DATE_CANDIDATES = ['FailureDate__c', 'DateOfFailure__c', 'IncidentDate__c', 'BreakdownDate__c'];

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
    let url: string | null = `/query?q=${encodeURIComponent(soql)}`;
    let first = true;

    while (url) {
      const res = await this.http.get<SFQueryResult<T>>(url, {
        headers: first ? { 'Sforce-Query-Options': 'batchSize=2000' } : {},
      });
      first = false;
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

      const repairDateMisMapped = this.FAILURE_DATE_CANDIDATES.some(
        c => c.toLowerCase() === (this.claimFieldMap.repairDate || '').toLowerCase(),
      );
      // Always run describe() after loading from DB to validate cached field names
      // against the actual org — wrong guesses (e.g. TotalLaborAmount__c for an org
      // that uses a different naming) are detected and reset here so re-discovery
      // runs below. One SF API call per service startup; result is cached in memory.
      const needsPatch = true;
      if (needsPatch) {
        try {
          const desc = await this.describe(this.claimObject);
          const fieldNames = desc.fields.map(f => f.name);

          // Clear stale amount mappings: if cached field name doesn't exist in this org,
          // reset it so re-discovery runs below
          if (this.claimFieldMap.laborAmount && !fieldNames.includes(this.claimFieldMap.laborAmount)) {
            this.logger.warn(`[FieldMap] laborAmount '${this.claimFieldMap.laborAmount}' not in org — resetting`);
            this.claimFieldMap.laborAmount = undefined;
          }
          if (this.claimFieldMap.partsAmount && !fieldNames.includes(this.claimFieldMap.partsAmount)) {
            this.logger.warn(`[FieldMap] partsAmount '${this.claimFieldMap.partsAmount}' not in org — resetting`);
            this.claimFieldMap.partsAmount = undefined;
          }
          if (this.claimFieldMap.totalAmount && !fieldNames.includes(this.claimFieldMap.totalAmount)) {
            this.logger.warn(`[FieldMap] totalAmount '${this.claimFieldMap.totalAmount}' not in org — resetting`);
            this.claimFieldMap.totalAmount = undefined;
          }

          // Discover failureDate if missing (field added after mapping was first cached)
          if (!this.claimFieldMap.failureDate) {
            const found = this.findField(fieldNames, this.FAILURE_DATE_CANDIDATES);
            if (found) {
              this.claimFieldMap.failureDate = found;
              await this.prisma.fieldMapping.upsert({
                where: { objectName_fieldKey: { objectName: this.claimObject, fieldKey: 'failureDate' } },
                update: { fieldName: found },
                create: { objectName: this.claimObject, fieldKey: 'failureDate', fieldName: found },
              });
              this.logger.log(`[FieldMap] failureDate discovered: ${found}`);
            }
          }

          // Correct repairDate if it was previously mis-mapped onto a failure-date field
          if (repairDateMisMapped) {
            const found = this.findField(fieldNames, this.REPAIR_DATE_CANDIDATES);
            if (found) {
              this.logger.log(`[FieldMap] repairDate corrected: ${this.claimFieldMap.repairDate} → ${found}`);
              this.claimFieldMap.repairDate = found;
              await this.prisma.fieldMapping.upsert({
                where: { objectName_fieldKey: { objectName: this.claimObject, fieldKey: 'repairDate' } },
                update: { fieldName: found },
                create: { objectName: this.claimObject, fieldKey: 'repairDate', fieldName: found },
              });
            }
          }

          // Patch dealerLookup if missing
          if (!this.claimFieldMap.dealerLookup) {
            const accountRefField = desc.fields.find(f =>
              f.type === 'reference' &&
              f.referenceTo?.some(r => r.toLowerCase() === 'account'),
            );
            if (accountRefField) {
              this.claimFieldMap.dealerLookup = accountRefField.name;
              await this.prisma.fieldMapping.upsert({
                where: { objectName_fieldKey: { objectName: this.claimObject, fieldKey: 'dealerLookup' } },
                update: { fieldName: accountRefField.name },
                create: { objectName: this.claimObject, fieldKey: 'dealerLookup', fieldName: accountRefField.name },
              });
              this.logger.log(`[FieldMap] dealerLookup patched: ${accountRefField.name}`);
            }
          }

          // Patch laborAmount / partsAmount if missing (SF report uses TotalLaborAmount__c / TotalPartAmount__c)
          if (!this.claimFieldMap.laborAmount) {
            const LABOR_CANDIDATES = ['TotalLaborAmount__c', 'LaborAmount__c', 'LaborCost__c', 'TotalLabor__c', 'Labor_Amount__c'];
            const found = this.findField(fieldNames, LABOR_CANDIDATES)
              || desc.fields.find(ff => ff.type === 'currency' && ff.name.toLowerCase().includes('labor'))?.name;
            if (found) {
              this.claimFieldMap.laborAmount = found;
              await this.prisma.fieldMapping.upsert({
                where: { objectName_fieldKey: { objectName: this.claimObject, fieldKey: 'laborAmount' } },
                update: { fieldName: found },
                create: { objectName: this.claimObject, fieldKey: 'laborAmount', fieldName: found },
              });
              this.logger.log(`[FieldMap] laborAmount patched: ${found}`);
            }
          }

          if (!this.claimFieldMap.partsAmount) {
            const PARTS_CANDIDATES = ['TotalPartAmount__c', 'TotalPartsAmount__c', 'PartsAmount__c', 'PartAmount__c', 'PartsCost__c', 'TotalParts__c', 'Part_Amount__c'];
            const found = this.findField(fieldNames, PARTS_CANDIDATES)
              || desc.fields.find(ff => ff.type === 'currency' && (ff.name.toLowerCase().includes('part') || ff.name.toLowerCase().includes('material')))?.name;
            if (found) {
              this.claimFieldMap.partsAmount = found;
              await this.prisma.fieldMapping.upsert({
                where: { objectName_fieldKey: { objectName: this.claimObject, fieldKey: 'partsAmount' } },
                update: { fieldName: found },
                create: { objectName: this.claimObject, fieldKey: 'partsAmount', fieldName: found },
              });
              this.logger.log(`[FieldMap] partsAmount patched: ${found}`);
            }
          }

          // Patch totalAmount if missing — use heuristic scoring across all currency fields
          if (!this.claimFieldMap.totalAmount) {
            const currencyFields = desc.fields.filter(f => f.type === 'currency');
            this.logger.log(`[FieldMap] totalAmount missing. Currency fields: ${currencyFields.map(f => f.name).join(', ') || '(none)'}`);
            const picked = this.pickBestAmountField(currencyFields, ['labor', 'part', 'tax', 'discount', 'fee', 'misc', 'other', 'adjust']);
            if (picked) {
              this.claimFieldMap.totalAmount = picked;
              await this.prisma.fieldMapping.upsert({
                where: { objectName_fieldKey: { objectName: this.claimObject, fieldKey: 'totalAmount' } },
                update: { fieldName: picked },
                create: { objectName: this.claimObject, fieldKey: 'totalAmount', fieldName: picked },
              });
              this.logger.log(`[FieldMap] totalAmount patched: ${picked} (heuristic)`);
            }
          }
        } catch (err) {
          this.logger.warn(`[FieldMap] Could not patch missing fields: ${err.message}`);
        }
      }
      return;
    }

    // Discover from Salesforce
    try {
      const desc = await this.describe(this.claimObject);
      const fieldNames = desc.fields.map(f => f.name);

      const mapping: Record<string, string[]> = {
        status: ['Status__c', 'ClaimStatus__c', 'Stage__c', 'ApprovalStatus__c'],
        dealerLookup: ['Dealer__c', 'Branch__c', 'Account__c', 'DealerAccount__c', 'AccountId'],
        dealerName: ['DealerName__c', 'AccountName__c'],
        model: ['Model__c', 'ModelName__c', 'ProductModel__c', 'UnitModel__c', 'EquipmentModel__c'],
        serialNumber: ['SerialNumber__c', 'VIN__c', 'UnitSerial__c', 'MachineSerialNumber__c', 'UnitSerialNumber__c'],
        repairDate: this.REPAIR_DATE_CANDIDATES,
        failureDate: this.FAILURE_DATE_CANDIDATES,
        submittedDate: ['SubmittedDate__c', 'SubmissionDate__c', 'ClaimDate__c'],
        approvedDate: ['ApprovedDate__c', 'ApprovalDate__c', 'ApprovedOn__c'],
        rejectedDate: ['RejectedDate__c', 'DeniedDate__c'],
        totalAmount: ['TotalAmount__c', 'ClaimAmount__c', 'TotalClaimAmount__c', 'Amount__c'],
        laborAmount: ['TotalLaborAmount__c', 'LaborAmount__c', 'LaborCost__c', 'TotalLabor__c', 'Labor_Amount__c'],
        partsAmount: ['TotalPartAmount__c', 'TotalPartsAmount__c', 'PartsAmount__c', 'PartAmount__c', 'PartsCost__c', 'TotalParts__c', 'Part_Amount__c'],
        hasHQProduct: ['HasHQProduct__c', 'HQProductIncluded__c', 'IsHQProduct__c', 'ContainsHQParts__c'],
        assignedTo: ['PersonInCharge__c', 'AssignedTo__c', 'AssignedUser__c', 'HandlerName__c', 'ClaimHandler__c'],
        assetLookup: ['AssetId', 'Asset__c', 'AssetLookup__c'],
        currencyIsoCode: ['CurrencyIsoCode'],
      };

      const discovered: Record<string, string> = {};
      for (const [key, candidates] of Object.entries(mapping)) {
        const found = this.findField(fieldNames, candidates);
        if (found) discovered[key] = found;
      }

      // If totalAmount not found via candidates, use heuristic scoring across all currency fields
      if (!discovered.totalAmount) {
        const currencyFields = desc.fields.filter(f => f.type === 'currency');
        this.logger.log(`[${this.claimObject}] All currency fields: ${currencyFields.map(f => f.name).join(', ') || '(none)'}`);
        const picked = this.pickBestAmountField(currencyFields, ['labor', 'part', 'tax', 'discount', 'fee', 'misc', 'other', 'adjust']);
        if (picked) {
          discovered.totalAmount = picked;
          this.logger.log(`[FieldMap] totalAmount → ${picked} (heuristic)`);
        }
      }

      // laborAmount fallback: prefer field containing 'labor'
      if (!discovered.laborAmount) {
        const f = desc.fields.find(ff => ff.type === 'currency' && ff.name.toLowerCase().includes('labor'));
        if (f) discovered.laborAmount = f.name;
      }

      // partsAmount fallback: prefer field containing 'part' or 'material'
      if (!discovered.partsAmount) {
        const f = desc.fields.find(ff => ff.type === 'currency' && (ff.name.toLowerCase().includes('part') || ff.name.toLowerCase().includes('material')));
        if (f) discovered.partsAmount = f.name;
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
  private amountFieldCache = new Map<string, string | null>();
  private queryableFieldCache = new Map<string, string[]>();

  async getQueryableFields(objectName: string): Promise<string[]> {
    if (this.queryableFieldCache.has(objectName)) return this.queryableFieldCache.get(objectName)!;
    const desc = await this.describe(objectName);
    // Compound types and encrypted strings cannot appear in SOQL SELECT
    const nonQueryable = new Set(['address', 'location', 'base64', 'encryptedstring']);
    const fields = desc.fields
      .filter(f => !nonQueryable.has(f.type.toLowerCase()))
      .map(f => f.name);
    this.queryableFieldCache.set(objectName, fields);
    this.logger.log(`[${objectName}] All queryable fields: ${fields.length}`);
    return fields;
  }

  /**
   * Picks the most likely "total amount" field from a list of currency-type fields
   * using heuristic scoring. deprioritizePatterns are sub-total field name patterns to avoid.
   */
  private pickBestAmountField(
    fields: { name: string }[],
    deprioritizePatterns: string[] = ['labor', 'part', 'tax', 'discount', 'fee', 'misc', 'other', 'adjust', 'deduct', 'retail', 'list', 'freight', 'shipping', 'penalty'],
  ): string | null {
    if (fields.length === 0) return null;
    if (fields.length === 1) return fields[0].name;

    const scored = fields.map(f => {
      const n = f.name.toLowerCase();
      let score = 0;
      if (n.includes('total')) score += 10;
      if (n.includes('amount')) score += 5;
      if (n.includes('claim')) score += 3;
      if (deprioritizePatterns.some(p => n.includes(p))) score -= 20;
      score -= f.name.length * 0.05;
      return { name: f.name, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].name;
  }

  /**
   * Discovers the best amount field on a Salesforce object.
   * Tries named candidates first (as hints), then uses heuristic scoring across
   * all currency-type fields. All found currency fields are logged.
   */
  async discoverAmountField(objectName: string, candidates: string[] = []): Promise<string | null> {
    const cacheKey = `${objectName}:amount`;
    if (this.amountFieldCache.has(cacheKey)) return this.amountFieldCache.get(cacheKey);
    try {
      const desc = await this.describe(objectName);
      const currencyFields = desc.fields.filter(f => f.type === 'currency');

      this.logger.log(`[${objectName}] Currency fields: ${currencyFields.map(f => f.name).join(', ') || '(none)'}`);

      if (currencyFields.length === 0) {
        this.amountFieldCache.set(cacheKey, null);
        return null;
      }

      // Step 1: try named candidates (exact name hints)
      const fieldNames = currencyFields.map(f => f.name);
      const lower = fieldNames.map(n => n.toLowerCase());
      for (const c of candidates) {
        const idx = lower.indexOf(c.toLowerCase());
        if (idx !== -1) {
          const picked = fieldNames[idx];
          this.amountFieldCache.set(cacheKey, picked);
          this.logger.log(`[${objectName}] Amount field (candidate match): ${picked}`);
          return picked;
        }
      }

      // Step 2: heuristic scoring across all currency fields
      const picked = this.pickBestAmountField(currencyFields);
      this.amountFieldCache.set(cacheKey, picked);
      if (picked) this.logger.log(`[${objectName}] Amount field (heuristic): ${picked}`);
      return picked;
    } catch (err) {
      this.logger.warn(`[${objectName}] discoverAmountField failed: ${err.message}`);
      this.amountFieldCache.set(cacheKey, null);
      return null;
    }
  }

  /**
   * Discovers if the object has a CurrencyIsoCode field (multi-currency Salesforce org).
   */
  async discoverCurrencyCodeField(objectName: string): Promise<string | null> {
    const cacheKey = `${objectName}:currencyCode`;
    if (this.amountFieldCache.has(cacheKey)) return this.amountFieldCache.get(cacheKey);
    try {
      const desc = await this.describe(objectName);
      const f = desc.fields.find(f => f.name.toLowerCase() === 'currencyisocode');
      const result = f?.name || null;
      this.amountFieldCache.set(cacheKey, result);
      if (result) this.logger.log(`[${objectName}] CurrencyIsoCode field: ${result}`);
      return result;
    } catch {
      this.amountFieldCache.set(cacheKey, null);
      return null;
    }
  }

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

    // Fetch ALL queryable fields — no guessing needed
    const queryableFields = await this.getQueryableFields(this.claimObject);

    // Relationship fields (sub-object traversal, not in describe)
    const relationFields: string[] = ['Owner.Name'];
    if (f.dealerLookup) {
      if (f.dealerLookup === 'AccountId') {
        relationFields.push('Account.Name');
      } else if (f.dealerLookup.endsWith('__c')) {
        relationFields.push(`${f.dealerLookup.replace('__c', '__r')}.Name`);
      }
    }
    if (f.assetLookup) {
      const assetRel = f.assetLookup === 'AssetId' ? 'Asset' : f.assetLookup.replace('__c', '__r');
      relationFields.push(`${assetRel}.SerialNumber`, `${assetRel}.Name`);
    }

    const selectFields = [...new Set([...queryableFields, ...relationFields])].join(', ');

    let soql = `SELECT ${selectFields} FROM ${this.claimObject} WHERE ${this.claimTypeField} = '${this.claimTypeValue}'`;
    if (lastModifiedDate) {
      soql += ` AND LastModifiedDate >= ${lastModifiedDate.toISOString()}`;
    }
    soql += ' ORDER BY LastModifiedDate ASC';

    return this.query(soql);
  }

  async getHQClaims(claimSfIds: string[]): Promise<any[]> {
    if (!claimSfIds.length) return [];
    const batchSize = 500;
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

    // Step 2: get ALL queryable fields + discover amount/currency for working table mapping
    const [allQueryableFields, amountField, currencyField] = await Promise.all([
      this.getQueryableFields(this.hqClaimObject),
      this.discoverAmountField(this.hqClaimObject, ['TotalAmount__c', 'Amount__c', 'ClaimAmount__c']),
      this.discoverCurrencyCodeField(this.hqClaimObject),
    ]);

    const selectFields = [...new Set(['Id', parentField, ...allQueryableFields])].join(', ');
    const batchSize = 500;
    const results: any[] = [];

    // Step 3: batch-query all claim IDs
    for (let i = 0; i < claimSfIds.length; i += batchSize) {
      const ids = claimSfIds.slice(i, i + batchSize).map(id => `'${id}'`).join(', ');
      try {
        const rows = await this.query(`SELECT ${selectFields} FROM ${this.hqClaimObject} WHERE ${parentField} IN (${ids})`);
        results.push(...rows.map(r => ({
          ...r,
          _claimSfId: r[parentField],
          _amount: amountField ? (r[amountField] ?? null) : null,
          _currency: currencyField ? (r[currencyField] ?? null) : null,
        })));
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

    // Step 2: get ALL queryable fields + discover key fields for working table mapping
    const [allQueryableFields, erpFields, amountField, currencyField] = await Promise.all([
      this.getQueryableFields(this.financialOrderObject),
      this.discoverERPFields(this.financialOrderObject),
      this.discoverAmountField(this.financialOrderObject, ['Amount__c', 'TotalAmount__c', 'CreditAmount__c', 'PaymentAmount__c']),
      this.discoverCurrencyCodeField(this.financialOrderObject),
    ]);

    const selectFields = [...new Set(['Id', parentField, ...allQueryableFields])].join(', ');
    const batchSize = 500;
    const results: any[] = [];

    // Step 3: batch-query all claim IDs
    for (let i = 0; i < claimSfIds.length; i += batchSize) {
      const ids = claimSfIds.slice(i, i + batchSize).map(id => `'${id}'`).join(', ');
      try {
        const rows = await this.query(`SELECT ${selectFields} FROM ${this.financialOrderObject} WHERE ${parentField} IN (${ids})`);
        results.push(...rows.map(r => ({
          ...r,
          _claimSfId: r[parentField],
          _erpStatus: erpFields.status ? (r[erpFields.status] ?? null) : null,
          _erpErrorMessage: erpFields.error ? (r[erpFields.error] ?? null) : null,
          _amount: amountField ? (r[amountField] ?? null) : null,
          _currency: currencyField ? (r[currencyField] ?? null) : null,
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

    // Step 2: get ALL queryable fields + discover amount/currency for working table mapping
    const [allQueryableFields, amountField, currencyField] = await Promise.all([
      this.getQueryableFields(this.billingDocObject),
      this.discoverAmountField(this.billingDocObject, ['Amount__c', 'TotalAmount__c', 'BillingAmount__c', 'PaymentAmount__c']),
      this.discoverCurrencyCodeField(this.billingDocObject),
    ]);

    const selectFields = [...new Set(['Id', parentField, ...allQueryableFields])].join(', ');
    const batchSize = 500;
    const results: any[] = [];

    // Step 3: batch-query
    for (let i = 0; i < orderSfIds.length; i += batchSize) {
      const ids = orderSfIds.slice(i, i + batchSize).map(id => `'${id}'`).join(', ');
      try {
        const rows = await this.query(`SELECT ${selectFields} FROM ${this.billingDocObject} WHERE ${parentField} IN (${ids})`);
        results.push(...rows.map(r => ({
          ...r,
          _orderSfId: r[parentField],
          _amount: amountField ? (r[amountField] ?? null) : null,
          _currency: currencyField ? (r[currencyField] ?? null) : null,
        })));
      } catch (err) {
        this.logger.warn(`[BillingDoc] Batch ${i}–${i + batchSize} failed: ${err.message}`);
      }
    }
    return results;
  }

  mapClaim(record: any): {
    id: string; sfId: string; claimNumber: string; claimType: string; status: string;
    dealerAccountId: string; dealerName: string; modelName: string; serialNumber: string;
    repairDate: Date; failureDate: Date; submittedDate: Date; approvedDate: Date; rejectedDate: Date;
    totalAmount: number; laborAmount: number; partsAmount: number; hasHQProduct: boolean;
    assignedTo: string; owner: string; currencyIsoCode: string; sfCreatedDate: Date; sfLastModified: Date; rawData: any;
  } {
    const f = this.claimFieldMap;

    // Assignee: dealer contact / person in charge (custom field only — not Owner)
    const assignedTo = (f.assignedTo ? record[f.assignedTo] : null) ?? null;

    // Owner: Salesforce record Owner (internal user)
    const owner = record.Owner?.Name ?? null;

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

    // Serial number: direct field first, then Asset relationship
    let serialNumber: string | null = f.serialNumber ? (record[f.serialNumber] ?? null) : null;
    if (!serialNumber && f.assetLookup) {
      const assetRel = f.assetLookup === 'AssetId' ? 'Asset' : f.assetLookup.replace('__c', '__r');
      const assetObj = record[assetRel];
      serialNumber = assetObj?.SerialNumber || assetObj?.Name || null;
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
      serialNumber,
      repairDate: f.repairDate ? (record[f.repairDate] ? new Date(record[f.repairDate]) : null) : null,
      failureDate: f.failureDate ? (record[f.failureDate] ? new Date(record[f.failureDate]) : null) : null,
      submittedDate: f.submittedDate ? (record[f.submittedDate] ? new Date(record[f.submittedDate]) : null) : (record.CreatedDate ? new Date(record.CreatedDate) : null),
      approvedDate: f.approvedDate ? (record[f.approvedDate] ? new Date(record[f.approvedDate]) : null) : null,
      rejectedDate: f.rejectedDate ? (record[f.rejectedDate] ? new Date(record[f.rejectedDate]) : null) : null,
      totalAmount: f.totalAmount ? (record[f.totalAmount] != null ? Number(record[f.totalAmount]) : null) : null,
      laborAmount: f.laborAmount ? (record[f.laborAmount] != null ? Number(record[f.laborAmount]) : null) : null,
      partsAmount: f.partsAmount ? (record[f.partsAmount] != null ? Number(record[f.partsAmount]) : null) : null,
      hasHQProduct: f.hasHQProduct ? Boolean(record[f.hasHQProduct]) : false,
      assignedTo,
      owner,
      currencyIsoCode: f.currencyIsoCode ? (record[f.currencyIsoCode] ?? null) : (record.CurrencyIsoCode ?? null),
      sfCreatedDate: record.CreatedDate ? new Date(record.CreatedDate) : null,
      sfLastModified: record.LastModifiedDate ? new Date(record.LastModifiedDate) : null,
      rawData: record,
    };
  }

  resetFieldMapping() {
    this.claimFieldMap = {};
    this.fieldMapLoaded = false;
    this.amountFieldCache.clear();
    this.relationshipCache.clear();
    this.erpFieldCache.clear();
    this.queryableFieldCache.clear();
  }
}
