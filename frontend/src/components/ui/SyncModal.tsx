import React, { useState } from 'react';
import { RefreshCw, Lock, CheckCircle, XCircle, X, Database, FileText, Building2, CreditCard, Receipt } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onClose: () => void;
  isSyncing: boolean;
  lastSync: any;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

const PHASE_META: Record<string, { icon: React.ReactNode; color: string }> = {
  fetching_claims: { icon: <FileText size={14} />, color: 'text-accent-blue' },
  syncing_claims:  { icon: <Database size={14} />, color: 'text-accent-blue-light' },
  syncing_hq:      { icon: <Building2 size={14} />, color: 'text-accent-purple-light' },
  syncing_orders:  { icon: <CreditCard size={14} />, color: 'text-accent-green-light' },
  syncing_docs:    { icon: <Receipt size={14} />, color: 'text-accent-orange-light' },
  done:            { icon: <CheckCircle size={14} />, color: 'text-accent-green-light' },
  error:           { icon: <XCircle size={14} />, color: 'text-accent-red-light' },
  idle:            { icon: <RefreshCw size={14} />, color: 'text-text-muted' },
};

function ProgressBar({ value, total, color = 'bg-accent-blue' }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="w-full bg-bg-elevated rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ProgressRow({
  icon, label, value, total, color, active,
}: {
  icon: React.ReactNode; label: string; value: number; total?: number; color: string; active: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 py-2 transition-opacity ${active ? 'opacity-100' : value > 0 ? 'opacity-70' : 'opacity-30'}`}>
      <span className={`shrink-0 ${color}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-medium ${active ? 'text-text-primary' : 'text-text-secondary'}`}>{label}</span>
          <span className="text-xs tabular-nums text-text-muted">
            {total !== undefined && total > 0
              ? `${value.toLocaleString()} / ${total.toLocaleString()}`
              : value > 0 ? value.toLocaleString() : '—'}
          </span>
        </div>
        {total !== undefined && total > 0 && (
          <ProgressBar value={value} total={total} color={color.replace('text-', 'bg-')} />
        )}
      </div>
      {active && <RefreshCw size={11} className={`shrink-0 animate-spin ${color}`} />}
    </div>
  );
}

export default function SyncModal({ open, onClose, isSyncing, lastSync }: Props) {
  const [password, setPassword] = useState('');
  const [forceFullSync, setForceFullSync] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const qc = useQueryClient();

  const { data: progress } = useQuery({
    queryKey: ['sync', 'progress'],
    queryFn: api.getSyncProgress,
    refetchInterval: isSyncing ? 1500 : false,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: ({ pw, force }: { pw: string; force: boolean }) => api.triggerSync(pw, force),
    onSuccess: (data) => {
      setResult(data);
      if (data.success) {
        qc.invalidateQueries({ queryKey: ['sync'] });
        setPassword('');
      }
    },
    onError: (err: any) => {
      setResult({ success: false, message: err.message || 'Sync failed' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    mutation.mutate({ pw: password, force: forceFullSync });
  };

  const handleClose = () => {
    setResult(null);
    setPassword('');
    onClose();
  };

  if (!open) return null;

  const phase = progress?.phase || 'idle';
  const phaseMeta = PHASE_META[phase] || PHASE_META.idle;
  const showProgress = isSyncing && phase !== 'idle';
  const isDone = phase === 'done';
  const isError = phase === 'error';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <RefreshCw size={18} className={isSyncing ? 'text-accent-blue animate-spin' : 'text-accent-blue'} />
            <h2 className="text-text-primary font-semibold text-base">Manual Sync</h2>
          </div>
          <button onClick={handleClose} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Last sync info */}
          {lastSync && !showProgress && (
            <div className="bg-bg-elevated rounded-lg p-3 text-sm space-y-1">
              <div className="text-text-muted text-xs font-medium uppercase tracking-wide">Last Sync</div>
              <div className="text-text-secondary">
                {format(new Date(lastSync.completedAt), 'MMM d, yyyy h:mm a')}
              </div>
              <div className="flex gap-4 text-xs text-text-muted pt-1">
                <span><span className="text-text-secondary">{lastSync.claimsSynced ?? 0}</span> claims</span>
                <span><span className="text-text-secondary">{lastSync.hqClaimsSynced ?? 0}</span> HQ</span>
                <span><span className="text-text-secondary">{lastSync.ordersSynced ?? 0}</span> orders</span>
                <span><span className="text-text-secondary">{lastSync.docsSynced ?? 0}</span> docs</span>
              </div>
            </div>
          )}

          {/* Sync mode toggle */}
          {!showProgress && !isDone && !isError && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-bg-elevated/50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-text-primary">
                    {forceFullSync ? 'Full Re-sync' : 'Incremental Sync'}
                  </span>
                  {!forceFullSync && lastSync && (
                    <span className="text-xs text-text-muted">
                      (since {format(new Date(lastSync.completedAt), 'MMM d, h:mm a')})
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  {forceFullSync
                    ? 'Re-syncs all records regardless of modification date. Use when data is missing or after field mapping reset.'
                    : 'Only fetches records modified since the last sync. Faster, but skips older missing data.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForceFullSync(v => !v)}
                className={`shrink-0 w-9 h-5 rounded-full transition-colors relative ${
                  forceFullSync ? 'bg-accent-orange' : 'bg-bg-hover'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  forceFullSync ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          )}

          {/* Real-time progress panel */}
          {(showProgress || isDone || isError) && progress && (
            <div className={`rounded-xl border p-4 space-y-1 ${
              isError ? 'border-accent-red/30 bg-accent-red/5' :
              isDone  ? 'border-accent-green/30 bg-accent-green/5' :
                        'border-accent-blue/20 bg-accent-blue/5'
            }`}>
              {/* Phase header */}
              <div className="flex items-center justify-between mb-3">
                <div className={`flex items-center gap-2 text-sm font-medium ${phaseMeta.color}`}>
                  {phaseMeta.icon}
                  <span>{progress.phaseLabel || 'Initializing…'}</span>
                </div>
                {progress.elapsedSeconds > 0 && (
                  <span className="text-xs text-text-muted tabular-nums">
                    {formatElapsed(progress.elapsedSeconds)}
                  </span>
                )}
              </div>

              {/* Progress rows */}
              <div className="divide-y divide-border/50">
                <ProgressRow
                  icon={<FileText size={13} />}
                  label="Claims fetched from Salesforce"
                  value={progress.claimsFetched}
                  color="text-accent-blue"
                  active={phase === 'fetching_claims'}
                />
                <ProgressRow
                  icon={<Database size={13} />}
                  label="Claims saved to database"
                  value={progress.claimsSynced}
                  total={progress.claimsTotal}
                  color="text-accent-blue-light"
                  active={phase === 'syncing_claims'}
                />
                <ProgressRow
                  icon={<Building2 size={13} />}
                  label="HQ Claims synced"
                  value={progress.hqSynced}
                  color="text-accent-purple-light"
                  active={phase === 'syncing_hq'}
                />
                <ProgressRow
                  icon={<CreditCard size={13} />}
                  label="Financial Orders synced"
                  value={progress.ordersSynced}
                  color="text-accent-green-light"
                  active={phase === 'syncing_orders'}
                />
                <ProgressRow
                  icon={<Receipt size={13} />}
                  label="Billing Documents synced"
                  value={progress.docsSynced}
                  color="text-accent-orange-light"
                  active={phase === 'syncing_docs'}
                />
              </div>
            </div>
          )}

          {/* Result message (after trigger) */}
          {result && !isSyncing && (
            <div className={`flex items-center gap-3 p-3 rounded-lg ${
              result.success
                ? 'bg-accent-green/10 border border-accent-green/20'
                : 'bg-accent-red/10 border border-accent-red/20'
            }`}>
              {result.success
                ? <CheckCircle size={16} className="text-accent-green-light shrink-0" />
                : <XCircle size={16} className="text-accent-red-light shrink-0" />
              }
              <span className={`text-sm ${result.success ? 'text-accent-green-light' : 'text-accent-red-light'}`}>
                {result.message}
              </span>
            </div>
          )}

          {/* Password form */}
          {!isSyncing && !isDone && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                  <Lock size={12} />
                  Sync Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter sync password"
                  className="input"
                  autoFocus
                  disabled={mutation.isPending}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={handleClose} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!password || mutation.isPending}
                  className={`flex-1 flex items-center justify-center gap-1.5 font-medium text-sm px-4 py-2 rounded-lg transition-all disabled:opacity-50 ${
                    forceFullSync
                      ? 'bg-accent-orange hover:bg-accent-orange/90 text-white'
                      : 'btn-primary'
                  }`}
                >
                  {mutation.isPending
                    ? <><RefreshCw size={14} className="animate-spin" /> Starting…</>
                    : forceFullSync
                      ? <><RefreshCw size={14} /> Full Re-sync</>
                      : <><RefreshCw size={14} /> Sync Now</>
                  }
                </button>
              </div>
            </form>
          )}

          {/* Close button after done */}
          {(isDone || isError) && !isSyncing && (
            <button onClick={handleClose} className="btn-secondary w-full mt-2">
              Close
            </button>
          )}

          {/* Close button while syncing */}
          {isSyncing && (
            <button onClick={handleClose} className="btn-ghost w-full text-xs text-text-muted">
              Hide (sync continues in background)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
