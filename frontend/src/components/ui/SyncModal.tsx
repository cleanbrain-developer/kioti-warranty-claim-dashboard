import React, { useState } from 'react';
import { RefreshCw, Lock, CheckCircle, XCircle, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onClose: () => void;
  isSyncing: boolean;
  lastSync: any;
}

export default function SyncModal({ open, onClose, isSyncing, lastSync }: Props) {
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (pw: string) => api.triggerSync(pw),
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
    mutation.mutate(password);
  };

  const handleClose = () => {
    setResult(null);
    setPassword('');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <RefreshCw size={18} className="text-accent-blue" />
            <h2 className="text-text-primary font-semibold text-base">Manual Sync</h2>
          </div>
          <button onClick={handleClose} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Last sync info */}
          {lastSync && (
            <div className="bg-bg-elevated rounded-lg p-3 text-sm space-y-1">
              <div className="text-text-muted text-xs font-medium uppercase tracking-wide">Last Sync</div>
              <div className="text-text-secondary">
                {format(new Date(lastSync.completedAt), 'MMM d, yyyy h:mm a')}
              </div>
              <div className="flex gap-4 text-xs text-text-muted pt-1">
                <span><span className="text-text-secondary">{lastSync.claimsSynced ?? 0}</span> claims</span>
                <span><span className="text-text-secondary">{lastSync.hqClaimsSynced ?? 0}</span> HQ claims</span>
                <span><span className="text-text-secondary">{lastSync.ordersSynced ?? 0}</span> orders</span>
              </div>
            </div>
          )}

          {isSyncing && (
            <div className="flex items-center gap-3 p-3 bg-accent-blue/10 border border-accent-blue/20 rounded-lg">
              <RefreshCw size={16} className="text-accent-blue animate-spin shrink-0" />
              <span className="text-accent-blue-light text-sm">Sync in progress…</span>
            </div>
          )}

          {result && (
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

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block flex items-center gap-1.5">
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
                disabled={isSyncing || mutation.isPending}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!password || isSyncing || mutation.isPending}
                className="btn-primary flex-1"
              >
                {mutation.isPending ? (
                  <><RefreshCw size={14} className="animate-spin" /> Starting…</>
                ) : (
                  <><RefreshCw size={14} /> Sync Now</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
