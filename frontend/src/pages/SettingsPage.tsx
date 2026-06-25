import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { Settings, Zap, RefreshCw, Clock, CheckCircle, AlertTriangle, CalendarClock } from 'lucide-react';
import { api } from '../api/client';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_OPTIONS = [0, 15, 30, 45];

export default function SettingsPage() {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['sync', 'settings'],
    queryFn: api.getSettings,
    refetchInterval: 60_000,
  });

  const [form, setForm] = useState({
    scheduledSyncMode: 'incremental',
    scheduledSyncHour: '1',
    scheduledSyncMinute: '0',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        scheduledSyncMode: settings.scheduledSyncMode ?? 'incremental',
        scheduledSyncHour: settings.scheduledSyncHour ?? '1',
        scheduledSyncMinute: settings.scheduledSyncMinute ?? '0',
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: () => api.updateSettings(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync', 'settings'] }),
  });

  const nextRun = settings?.nextRun ? new Date(settings.nextRun) : null;
  const lastScheduledSync = settings?.lastScheduledSync ? new Date(settings.lastScheduledSync) : null;

  const previewHour = parseInt(form.scheduledSyncHour, 10);
  const previewMinute = parseInt(form.scheduledSyncMinute, 10);
  const previewTime = `${String(previewHour).padStart(2, '0')}:${String(previewMinute).padStart(2, '0')}`;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-slide-up max-w-2xl">
        <div className="h-8 w-32 bg-bg-elevated rounded animate-pulse" />
        <div className="card p-6 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-bg-elevated rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-2xl">
      {/* Page header */}
      <div className="flex items-center gap-2.5">
        <Settings size={18} className="text-text-secondary" />
        <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
      </div>

      {/* Scheduled Sync card */}
      <div className="card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <CalendarClock size={15} className="text-text-secondary" />
          <h2 className="text-sm font-semibold text-text-primary">Scheduled Sync</h2>
        </div>

        {/* Next / Last run info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-elevated rounded-lg p-3 space-y-0.5">
            <p className="text-[10px] uppercase tracking-wide font-medium text-text-muted">Next Scheduled Run</p>
            {nextRun ? (
              <>
                <p className="text-sm font-semibold text-text-primary">{format(nextRun, 'MMM d, yyyy h:mm a')}</p>
                <p className="text-xs text-text-muted">{formatDistanceToNow(nextRun, { addSuffix: true })}</p>
              </>
            ) : (
              <p className="text-sm text-text-muted">—</p>
            )}
          </div>
          <div className="bg-bg-elevated rounded-lg p-3 space-y-0.5">
            <p className="text-[10px] uppercase tracking-wide font-medium text-text-muted">Last Scheduled Sync</p>
            {lastScheduledSync ? (
              <>
                <p className="text-sm font-semibold text-text-primary">{format(lastScheduledSync, 'MMM d, yyyy h:mm a')}</p>
                <p className="text-xs text-text-muted">{formatDistanceToNow(lastScheduledSync, { addSuffix: true })}</p>
              </>
            ) : (
              <p className="text-sm text-text-muted">No scheduled sync yet</p>
            )}
          </div>
        </div>

        {/* Sync Mode */}
        <div>
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block mb-2">
            Sync Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, scheduledSyncMode: 'incremental' }))}
              className={`p-3 rounded-xl border text-left transition-all ${
                form.scheduledSyncMode !== 'full'
                  ? 'border-accent-blue/50 bg-accent-blue/10 ring-1 ring-accent-blue/30'
                  : 'border-border bg-bg-elevated/40 hover:border-border-emphasis'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap size={13} className={form.scheduledSyncMode !== 'full' ? 'text-accent-blue-light' : 'text-text-muted'} />
                <span className={`text-xs font-semibold ${form.scheduledSyncMode !== 'full' ? 'text-accent-blue-light' : 'text-text-muted'}`}>
                  Incremental
                </span>
                {form.scheduledSyncMode !== 'full' && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-blue shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">Only fetches records modified since last sync</p>
            </button>

            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, scheduledSyncMode: 'full' }))}
              className={`p-3 rounded-xl border text-left transition-all ${
                form.scheduledSyncMode === 'full'
                  ? 'border-accent-orange/50 bg-accent-orange/10 ring-1 ring-accent-orange/30'
                  : 'border-border bg-bg-elevated/40 hover:border-border-emphasis'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw size={13} className={form.scheduledSyncMode === 'full' ? 'text-accent-orange-light' : 'text-text-muted'} />
                <span className={`text-xs font-semibold ${form.scheduledSyncMode === 'full' ? 'text-accent-orange-light' : 'text-text-muted'}`}>
                  Full Re-sync
                </span>
                {form.scheduledSyncMode === 'full' && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-orange shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">Re-syncs all records regardless of date</p>
            </button>
          </div>
          {form.scheduledSyncMode === 'full' && (
            <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-accent-orange/10 border border-accent-orange/20 text-[11px] text-accent-orange-light">
              <AlertTriangle size={11} className="shrink-0 mt-0.5" />
              Full sync fetches ALL records from Salesforce on each scheduled run. Use for smaller datasets or when data completeness is critical.
            </div>
          )}
        </div>

        {/* Execution Time */}
        <div>
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block mb-2">
            Daily Execution Time
          </label>
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-text-muted">Hour (0–23)</span>
              <select
                value={form.scheduledSyncHour}
                onChange={e => setForm(f => ({ ...f, scheduledSyncHour: e.target.value }))}
                className="select w-20 text-sm"
              >
                {HOUR_OPTIONS.map(h => (
                  <option key={h} value={String(h)}>{String(h).padStart(2, '0')}</option>
                ))}
              </select>
            </div>
            <span className="text-text-muted mt-4 text-lg">:</span>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-text-muted">Minute</span>
              <select
                value={form.scheduledSyncMinute}
                onChange={e => setForm(f => ({ ...f, scheduledSyncMinute: e.target.value }))}
                className="select w-20 text-sm"
              >
                {MINUTE_OPTIONS.map(m => (
                  <option key={m} value={String(m)}>{String(m).padStart(2, '0')}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5 mt-4">
              <Clock size={13} className="text-text-muted" />
              <span className="text-sm text-text-secondary">
                Every day at <span className="font-mono font-semibold text-text-primary">{previewTime}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div>
            {mutation.isSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-accent-green-light">
                <CheckCircle size={13} />
                Settings saved — new schedule is active
              </div>
            )}
            {mutation.isError && (
              <div className="flex items-center gap-1.5 text-xs text-accent-red-light">
                <AlertTriangle size={13} />
                Failed to save settings
              </div>
            )}
          </div>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-primary text-xs px-5 py-2 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Sync Objects info */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Sync Objects</h2>
        <div className="space-y-2 text-xs text-text-secondary">
          {[
            { label: 'Warranty Claims', obj: 'Claim__c', desc: 'Main warranty repair claim records' },
            { label: 'Dealer Accounts', obj: 'Account', desc: 'Dealer information linked to claims' },
            { label: 'HQ Claims', obj: 'HQClaim__c', desc: 'Headquarter claim records linked to warranty claims' },
            { label: 'Financial Orders', obj: 'FinancialOrder__c', desc: 'Financial orders with ERP transmission status' },
            { label: 'Billing Documents', obj: 'BillingDocument__c', desc: 'Credit memo and billing documents linked to financial orders' },
          ].map(({ label, obj, desc }) => (
            <div key={obj} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{label}</span>
                  <span className="font-mono text-text-muted text-[10px] bg-bg-elevated px-1.5 py-0.5 rounded">{obj}</span>
                </div>
                <p className="text-text-muted mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
