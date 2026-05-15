
import { create } from 'zustand';

interface OnlineStore {
  online: boolean;
  setOnline: (v: boolean) => void;
}

export const useOnlineStore = create<OnlineStore>((set) => ({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (online) => set({ online }),
}));

let initialized = false;

export function initOnlineMonitor() {
  if (initialized) return;
  initialized = true;
  const apply = (v: boolean) => useOnlineStore.getState().setOnline(v);
  apply(navigator.onLine);
  window.addEventListener('online',  () => apply(true));
  window.addEventListener('offline', () => apply(false));
}
