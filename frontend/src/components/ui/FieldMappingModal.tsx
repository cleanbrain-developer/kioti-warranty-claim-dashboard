import React, { useState } from 'react';
import { X, Database, RefreshCw, AlertTriangle, CheckCircle, XCircle, Link } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

const FIELD_LABELS: Record<string, string> = {
  status: 'Claim Status',
  dealerLookup: 'Dealer (Lookup Field)',
  dealerName: 'Dealer Name (Text)',
  model: 'Equipment Model',
  serialNumber: 'Serial Number',
  repairDate: 'Repair Date',
  submittedDate: 'Submitted Date',
  approvedDate: 'Approved Date',
  rejectedDate: 'Rejected Date',
  totalAmount: 'Total Amount',
  laborAmount: 'Labor Amount',
  partsAmount: 'Parts Amount',
  hasHQProduct: 'Has HQ Product',
  assignedTo: 'Assigned To',
};

const ALL_KEYS = Object.keys(FIELD_LABELS);

const COMMON_OBJECTS = [
  { label: 'Claim (Main)', value: '' },
  { label: 'Dealer Account', value: 'Account' },
  { label: 'HQ Claim', value: 'HQClaim__c' },
  { label: 'Financial Order', value: 'FinancialOrder__c' },
  { label: 'Billing Document', value: 'BillingDocument__c' },
];

type SFField = { name: string; label: string; type: string; referenceTo?: string[] };

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function FieldMappingModal({ open, onClose }: Props) {
  const [describeObject, setDescribeObject] = useState('');
  const [customObject, setCustomObject] = useState('');
  const [sfFields, setSfFields] = useState<SFField[] | null>(null);
  const [sfLoading, setSfLoading] = useState(false);
  const [sfError, setSfError] = useState<string | null>(null);
  const [showRefOnly, setShowRefOnly] = useState(false);
  const [password, setPassword] = useState('');
  const [fullSyncResult, setFullSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: mappings, refetch: refetchMappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ['sync', 'field-mappings'],
    queryFn: api.getFieldMappings,
    enabled: open,
  });

  const resetMutation = useMutation({
    mutationFn: api.resetFieldMappings,
    onSuccess: () => {
      refetchMappings();
      setSfFields(null);
    },
  });

  const syncMutation = useMutation({
    mutationFn: (pw: string) => api.triggerSync(pw, true),
    onSuccess: (data) => setFullSyncResult(data),
    onError: (err: any) => setFullSyncResult({ success: false, message: err.message }),
  });

  const loadSfFields = async () => {
    setSfLoading(true);
    setSfError(null);
    setSfFields(null);
    try {
      const target = customObject.trim() || describeObject || undefined;
      const fields = await api.describeFields(target);
      setSfFields(fields);
    } catch (err: any) {
      setSfError(err.message || 'Failed to load fields from Salesforce');
    } finally {
      setSfLoading(false);
    }
  };

  if (!open) return null;

  const foundCount = mappings ? ALL_KEYS.filter(k => mappings[k]).length : 0;
  const missingKeys = mappings ? ALL_KEYS.filter(k => !mappings[k]) : [];
  const displayedObject = customObject.trim() || describeObject || 'Claim__c (default)';

  const refFields = sfFields?.filter(f => f.type === 'reference') ?? [];
  const visibleFields = showRefOnly ? refFields : (sfFields ?? []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-accent-blue" />
            <h2 className="text-text-primary font-semibold text-base">Salesforce Field Mapping</h2>
            {!mappingsLoading && (
              <span className="text-xs text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full">
                {foundCount}/{ALL_KEYS.length} mapped
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Warning */}
          {missingKeys.length > 0 && (
            <div className="flex gap-3 p-3 rounded-lg bg-accent-orange/10 border border-accent-orange/20">
              <AlertTriangle size={16} className="text-accent-orange-light shrink-0 mt-0.5" />
              <div className="text-xs text-text-secondary space-y-1">
                <p className="font-medium text-text-primary">
                  {missingKeys.length} field{missingKeys.length > 1 ? 's' : ''} not mapped — these columns will show <strong>—</strong> in the table.
                </p>
                <p>
                  Use <strong>Describe Object</strong> to inspect available fields in your Salesforce org,
                  then <strong>Reset & Re-discover</strong> to re-run auto-mapping. After that, run a <strong>Full Sync</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Current Mappings */}
          <div>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
              Current Field Mapping (Claim object)
            </h3>
            {mappingsLoading ? (
              <div className="text-xs text-text-muted flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin" /> Loading…
              </div>
            ) : (
              <div className="bg-bg-elevated rounded-lg overflow-hidden border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left font-semibold text-text-secondary w-1/2">Dashboard Field</th>
                      <th className="px-3 py-2 text-left font-semibold text-text-secondary">Salesforce API Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {ALL_KEYS.map(key => (
                      <tr key={key} className={!mappings?.[key] ? 'opacity-60' : ''}>
                        <td className="px-3 py-2 text-text-secondary">{FIELD_LABELS[key]}</td>
                        <td className="px-3 py-2">
                          {mappings?.[key] ? (
                            <span className="font-mono text-accent-green-light">{mappings[key]}</span>
                          ) : (
                            <span className="text-text-muted italic">not found</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Describe Object */}
          <div>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
              Inspect Salesforce Object Fields
            </h3>
            <p className="text-xs text-text-muted mb-3">
              Select an object to see its fields. Use <strong>Financial Order</strong> to find the relationship field back to Claim.
              Reference fields (lookup/master-detail) show what object they point to.
            </p>

            {/* Object selector */}
            <div className="flex gap-2 mb-2 flex-wrap">
              {COMMON_OBJECTS.map(o => (
                <button
                  key={o.value}
                  onClick={() => { setDescribeObject(o.value); setCustomObject(''); setSfFields(null); setSfError(null); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    describeObject === o.value && !customObject.trim()
                      ? 'bg-accent-blue/10 border-accent-blue/40 text-accent-blue-light'
                      : 'border-border text-text-secondary hover:border-border-emphasis hover:text-text-primary'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {/* Custom object input */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={customObject}
                onChange={e => { setCustomObject(e.target.value); setSfFields(null); setSfError(null); }}
                placeholder="Custom object name (e.g. MyObject__c)"
                className="input text-xs flex-1"
              />
              <button
                onClick={loadSfFields}
                disabled={sfLoading}
                className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-emphasis transition-all disabled:opacity-50 shrink-0"
              >
                {sfLoading
                  ? <><RefreshCw size={11} className="animate-spin" /> Loading…</>
                  : `Describe ${displayedObject}`}
              </button>
            </div>

            {sfError && (
              <div className="text-xs text-accent-red-light bg-accent-red/10 border border-accent-red/20 rounded-lg p-3 mb-2">
                {sfError}
              </div>
            )}

            {sfFields && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-text-muted">
                    <strong className="text-text-secondary">{sfFields.length}</strong> fields total ·{' '}
                    <strong className="text-accent-blue-light">{refFields.length}</strong> relationship fields
                  </span>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showRefOnly}
                      onChange={e => setShowRefOnly(e.target.checked)}
                      className="accent-accent-blue"
                    />
                    <span className="text-text-secondary">Reference fields only</span>
                  </label>
                </div>
                <div className="bg-bg-elevated rounded-lg border border-border max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-bg-elevated border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-text-secondary">API Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-text-secondary">Type</th>
                        <th className="px-3 py-2 text-left font-semibold text-text-secondary">Points To</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {visibleFields.map(f => (
                        <tr key={f.name} className={f.type === 'reference' ? 'bg-accent-blue/5' : ''}>
                          <td className="px-3 py-1.5 font-mono text-text-primary">{f.name}</td>
                          <td className="px-3 py-1.5 text-text-muted">{f.type}</td>
                          <td className="px-3 py-1.5">
                            {f.referenceTo?.length ? (
                              <span className="flex items-center gap-1 text-accent-blue-light">
                                <Link size={10} />
                                {f.referenceTo.join(', ')}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Actions</h3>

            {/* Reset mapping */}
            <div>
              <p className="text-xs text-text-muted mb-2">
                Clears the cached field mapping and re-discovers from Salesforce.
                Does not delete claim data. After resetting, run a Full Sync.
              </p>
              {resetMutation.data && (
                <div className="mb-2 p-3 rounded-lg bg-accent-green/10 border border-accent-green/20 text-xs text-accent-green-light flex items-center gap-2">
                  <CheckCircle size={13} />
                  Re-discovered {resetMutation.data.count} fields. Now run Full Sync to repopulate data.
                </div>
              )}
              {resetMutation.error && (
                <div className="mb-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/20 text-xs text-accent-red-light flex items-center gap-2">
                  <XCircle size={13} />
                  {(resetMutation.error as any).message}
                </div>
              )}
              <button
                onClick={() => { resetMutation.reset(); resetMutation.mutate(); }}
                disabled={resetMutation.isPending}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-emphasis transition-all disabled:opacity-50"
              >
                {resetMutation.isPending
                  ? <><RefreshCw size={12} className="animate-spin" /> Resetting…</>
                  : <><Database size={12} /> Reset & Re-discover Fields</>}
              </button>
            </div>

            {/* Full sync */}
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-text-muted mb-2">
                Run a full sync (ignores incremental date) to re-sync all records with the updated field mapping.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && password && syncMutation.mutate(password)}
                  placeholder="Sync password"
                  className="input text-xs flex-1"
                />
                <button
                  onClick={() => { setFullSyncResult(null); syncMutation.mutate(password); }}
                  disabled={!password || syncMutation.isPending}
                  className="btn-primary text-xs px-4 disabled:opacity-50"
                >
                  {syncMutation.isPending
                    ? <><RefreshCw size={12} className="animate-spin" /> Starting…</>
                    : 'Full Sync'}
                </button>
              </div>
              {fullSyncResult && (
                <div className={`mt-2 flex items-center gap-2 text-xs ${fullSyncResult.success ? 'text-accent-green-light' : 'text-accent-red-light'}`}>
                  {fullSyncResult.success ? <CheckCircle size={13} /> : <XCircle size={13} />}
                  {fullSyncResult.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
