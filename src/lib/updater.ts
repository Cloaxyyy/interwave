
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { create } from 'zustand';

interface UpdateStore {
  status: 'idle' | 'checking' | 'available' | 'installing' | 'error';
  update: Update | null;
  newVersion: string | null;
  error: string | null;
  setStatus: (s: UpdateStore['status']) => void;
  setUpdate: (u: Update | null) => void;
  setError: (e: string | null) => void;
}

export const useUpdateStore = create<UpdateStore>((set) => ({
  status: 'idle',
  update: null,
  newVersion: null,
  error: null,
  setStatus: (status) => set({ status }),
  setUpdate: (update) => set({ update, newVersion: update?.version ?? null }),
  setError: (error) => set({ error }),
}));

export async function checkForUpdate(): Promise<void> {
  const store = useUpdateStore.getState();
  if (store.status === 'checking' || store.status === 'installing') return;
  store.setStatus('checking');
  store.setError(null);
  try {
    const update = await check();
    if (update) {
      store.setUpdate(update);
      store.setStatus('available');
      console.info('[updater] Update available:', update.version);
    } else {
      store.setUpdate(null);
      store.setStatus('idle');
    }
  } catch (e: any) {
    console.warn('[updater] check failed:', e);
    store.setStatus('error');
    store.setError(typeof e === 'string' ? e : e?.message ?? 'check failed');
  }
}

export async function applyUpdate(): Promise<void> {
  const store = useUpdateStore.getState();
  const update = store.update;
  if (!update) return;
  store.setStatus('installing');
  try {
    await update.downloadAndInstall();

    await relaunch();
  } catch (e: any) {
    console.error('[updater] install failed:', e);
    store.setStatus('error');
    store.setError(typeof e === 'string' ? e : e?.message ?? 'install failed');
  }
}
