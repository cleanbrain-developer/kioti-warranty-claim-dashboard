import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Users, Sun, Moon, Database } from 'lucide-react';
import { api } from '../../api/client';
import { useStore } from '../../store/useStore';
import SyncModal from '../ui/SyncModal';
import FieldMappingModal from '../ui/FieldMappingModal';

const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function Header() {
  const [syncOpen, setSyncOpen] = useState(false);
  const [fieldMappingOpen, setFieldMappingOpen] = useState(false);
  const { theme, toggleTheme } = useStore();
  const qc = useQueryClient();
  const wasSyncing = useRef(false);

  const { data: syncStatus } = useQuery({
    queryKey: ['sync', 'status'],
    queryFn: api.getSyncStatus,
    refetchInterval: 5000,
  });

  // Auto-refresh all data when sync completes
  useEffect(() => {
    const nowSyncing = !!syncStatus?.isSyncing;
    if (wasSyncing.current && !nowSyncing) {
      qc.invalidateQueries();
    }
    wasSyncing.current = nowSyncing;
  }, [syncStatus?.isSyncing, qc]);

  const { data: visitors } = useQuery({
    queryKey: ['visitors', 'today', browserTz],
    queryFn: () => api.getTodayVisitors(browserTz),
    refetchInterval: 60_000,
  });

  const lastSync = syncStatus?.lastSync;
  const lastSyncLabel = lastSync
    ? new Date(lastSync.completedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        timeZone: browserTz,
      })
    : 'Never';

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
            {/* Last sync info */}
            <div className="hidden sm:flex items-center gap-1.5 text-text-muted text-xs">
              <span>Last sync:</span>
              <span className="text-text-secondary">{lastSyncLabel}</span>
            </div>

            {/* Field mapping button */}
            <button
              onClick={() => setFieldMappingOpen(true)}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors"
              title="Field Mapping"
            >
              <Database size={15} />
            </button>

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

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
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

      <FieldMappingModal
        open={fieldMappingOpen}
        onClose={() => setFieldMappingOpen(false)}
      />
    </>
  );
}
