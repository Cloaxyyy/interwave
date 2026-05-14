// Online/offline tracker — navigator.onLine + 30s liveness probe.

import { create } from 'zustand';

interface OnlineStore {
  online: boolean;
  setOnline: (v: boolean) => void;
}

export const useOnlineStore = create<OnlineStore>((set) => ({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (online) => set({ online }),
}));

let intervalId: ReturnType<typeof setInterval> | null = null;

/** Initialise once at app startup. Idempotent. */
export function initOnlineMonitor() {
  if (intervalId !== null) return;
  const apply = (v: boolean) => useOnlineStore.getState().setOnline(v);
  apply(navigator.onLine);

  window.addEventListener('online',  () => apply(true));
  window.addEventListener('offline', () => apply(false));

  // Periodic liveness probe — tiny request, every 30s.
  intervalId = setInterval(async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      // GitHub status endpoint — small, cors-friendly, no auth needed
      await fetch('https://www.gstatic.com/generate_204', {
        method: 'HEAD', cache: 'no-store', signal: ctrl.signal, mode: 'no-cors',
      });
      clearTimeout(t);
      apply(true);
    } catch { apply(false); }
  }, 30 * 1000);
}
