export interface BillingDocument {
  id: string;
  sfId: string;
  documentNumber: string | null;
  documentType: string | null;
  status: string | null;
  amount: number | null;
  billingDate: string | null;
  sfLink: string | null;
}

export interface FinancialOrder {
  id: string;
  sfId: string;
  orderNumber: string | null;
  orderType: string | null;
  status: string | null;
  amount: number | null;
  orderDate: string | null;
  sfLink: string | null;
  billingDocuments: BillingDocument[];
}

export interface HQClaim {
  id: string;
  sfId: string;
  hqClaimNumber: string | null;
  status: string | null;
  judgmentResult: string | null;
  totalAmount: number | null;
  sfLink: string | null;
}

export interface WarrantyClaim {
  id: string;
  sfId: string;
  claimNumber: string | null;
  claimType: string | null;
  status: string | null;
  dealerName: string | null;
  modelName: string | null;
  serialNumber: string | null;
  repairDate: string | null;
  submittedDate: string | null;
  approvedDate: string | null;
  rejectedDate: string | null;
  totalAmount: number | null;
  laborAmount: number | null;
  partsAmount: number | null;
  hasHQProduct: boolean;
  sfCreatedDate: string | null;
  sfLink: string | null;
  hqClaims: HQClaim[];
  financialOrders: FinancialOrder[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OverviewData {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  other: number;
  totalAmount: number;
  hqClaimsCount: number;
  financialOrdersCount: number;
  billingDocsCount: number;
}

export interface StatusData {
  status: string;
  count: number;
  amount: number;
}

export interface DealerData {
  dealer: string;
  count: number;
  amount: number;
}

export interface ModelData {
  model: string;
  count: number;
  amount: number;
}

export interface MonthlyTrendData {
  month: string;
  total: number;
  approved: number;
  rejected: number;
  total_amount: number;
}

export interface AgingBuckets {
  '0_30': number;
  '31_60': number;
  '61_90': number;
  '91_180': number;
  '181_365': number;
  '365_plus': number;
  total: number;
  avg_age: number;
  max_age: number;
}

export interface AgingByDimension {
  dealer?: string;
  model?: string;
  '0_30': number;
  '31_60': number;
  '61_90': number;
  '91_180': number;
  '181_365': number;
  '365_plus': number;
  total: number;
  avg_age: number;
}

export interface AgingData {
  buckets: AgingBuckets;
  byDealer: AgingByDimension[];
  byModel: AgingByDimension[];
  oldestClaims: (Partial<WarrantyClaim> & { ageDays: number })[];
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSync: {
    completedAt: string;
    claimsSynced: number;
    hqClaimsSynced: number;
    ordersSynced: number;
    docsSynced: number;
  } | null;
  recentLogs: {
    id: string;
    syncType: string;
    status: string;
    claimsSynced: number | null;
    errorMessage: string | null;
    startedAt: string;
    completedAt: string | null;
  }[];
}

export type TimezoneOption = {
  label: string;
  value: string;
  abbr: string;
};

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { label: 'System (Browser)', value: 'local', abbr: 'LOCAL' },
  { label: 'Eastern (EST/EDT)', value: 'America/New_York', abbr: 'ET' },
  { label: 'Central (CST/CDT)', value: 'America/Chicago', abbr: 'CT' },
  { label: 'Pacific (PST/PDT)', value: 'America/Los_Angeles', abbr: 'PT' },
  { label: 'Korean (KST)', value: 'Asia/Seoul', abbr: 'KST' },
  { label: 'UTC', value: 'UTC', abbr: 'UTC' },
];
