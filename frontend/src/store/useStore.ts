import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  timezone: string;
  setTimezone: (tz: string) => void;
  scrollMode: 'pagination' | 'infinite';
  setScrollMode: (mode: 'pagination' | 'infinite') => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      timezone: 'local',
      setTimezone: (tz) => set({ timezone: tz }),
      scrollMode: 'pagination',
      setScrollMode: (mode) => set({ scrollMode: mode }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    }),
    { name: 'kioti-warranty-prefs' },
  ),
);

// Session ID for visitor tracking (persists only for browser session)
function getSessionId(): string {
  const key = 'kioti_sid';
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

export const sessionId = getSessionId();
