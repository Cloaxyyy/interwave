// Singleton store for live maintenance + suspension state.

import { create } from 'zustand';
import type { MaintenanceRow, SuspensionRow } from '../lib/admin';

interface MaintenanceStore {
  maintenance: MaintenanceRow[];
  suspension: SuspensionRow | null;
  setMaintenance: (m: MaintenanceRow[]) => void;
  setSuspension: (s: SuspensionRow | null) => void;
}

export const useMaintenanceStore = create<MaintenanceStore>((set) => ({
  maintenance: [],
  suspension: null,
  setMaintenance: (maintenance) => set({ maintenance }),
  setSuspension: (suspension) => set({ suspension }),
}));

/** Returns the maintenance row for a specific page, or null. */
export function useMaintenanceFor(page: string): MaintenanceRow | null {
  const rows = useMaintenanceStore((s) => s.maintenance);
  return rows.find((r) => r.page === page && r.enabled) ?? null;
}

/** Global maintenance — covers the entire app. */
export function useGlobalMaintenance(): MaintenanceRow | null {
  return useMaintenanceFor('global');
}

export function useSuspension(): SuspensionRow | null {
  return useMaintenanceStore((s) => s.suspension);
}
