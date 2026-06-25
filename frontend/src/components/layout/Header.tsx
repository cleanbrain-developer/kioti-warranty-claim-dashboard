import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Users, Sun, Globe } from 'lucide-react';
import { api } from '../../api/client';
import { useStore } from '../../store/useStore';
import { TIMEZONE_OPTIONS } from '../../types';
import SyncModal from '../ui/SyncModal';

export default function Header() {
  const [syncOpen, setSyncOpen] = useState(false);
  const { timezone, setTimezone } = useStore();

  const { data: syncStatus } = useQuery({
    queryKey: ['sync', 'status'],
    queryFn: api.getSyncStatus,
    refetchInterval: 5000,
  });

  const { data: visitors } = useQuery({
    queryKey: ['visitors', 'today'],
    queryFn: api.getTodayVisitors,
    refetchInterval: 60_000,
  });

  const lastSync = syncStatus?.lastSync;
  const lastSyncLabel = lastSync
    ? new Date(lastSync.completedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        timeZone: timezone === 'local' ? undefined : timezone,
      })
    : 'Never';

  const currentTz = TIMEZONE_OPTIONS.find(o => o.value === timezone) || TIMEZONE_OPTIONS[0];

  return (
    <>
      <header className="bg-bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo + Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-bg-elevated flex items-center justify-center">
              <img
                src="/kioti-logo.png"
                alt="Kioti"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML =
                    '<span class="text-accent-blue font-bold text-sm">K</span>';
                }}
              />
            </div>
            <div>
              <div className="text-text-primary font-semibold text-sm leading-tight">
                Kioti <span className="text-accent-blue-light">Warranty</span>
              </div>
              <div className="text-text-muted text-xs leading-tight">Claim Dashboard</div>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* Timezone selector */}
            <div className="flex items-center gap-1.5 text-text-secondary">
              <Globe size={13} />
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="bg-transparent text-xs text-text-secondary focus:outline-none cursor-pointer hover:text-text-primary transition-colors"
              >
                {TIMEZONE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} className="bg-bg-elevated text-text-primary">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-px h-4 bg-border" />

            {/* Last sync info */}
            <div className="hidden sm:flex items-center gap-1.5 text-text-muted text-xs">
              <span>Last sync:</span>
              <span className="text-text-secondary">{lastSyncLabel}</span>
            </div>

            {/* Sync button */}
            <button
              onClick={() => setSyncOpen(true)}
              disabled={syncStatus?.isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated border border-border text-text-secondary text-xs hover:text-text-primary hover:border-border-emphasis transition-all disabled:opacity-50"
            >
              <RefreshCw
                size={13}
                className={syncStatus?.isSyncing ? 'animate-spin text-accent-blue' : ''}
              />
              <span className="hidden sm:inline">
                {syncStatus?.isSyncing ? 'Syncing…' : 'Sync'}
              </span>
            </button>

            <div className="w-px h-4 bg-border" />

            {/* Today's visitor count */}
            <div className="flex items-center gap-1.5 text-text-secondary text-xs">
              <Users size={13} />
              <span className="text-text-primary font-medium">{visitors?.count ?? 0}</span>
              <span className="hidden sm:inline">today</span>
            </div>

            {/* Theme placeholder */}
            <button className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors">
              <Sun size={15} />
            </button>
          </div>
        </div>
      </header>

      <SyncModal
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        isSyncing={syncStatus?.isSyncing || false}
        lastSync={syncStatus?.lastSync}
      />
    </>
  );
}
