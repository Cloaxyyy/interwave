import { create } from 'zustand';
import type { ImportProgressEvent, ImportCompleteEvent } from '../lib/tauri';

export type ImportStatus = 'idle' | 'importing' | 'done' | 'error';

interface ImportStore {
  importStatus: ImportStatus;
  importProgress: ImportProgressEvent | null;
  importResult: ImportCompleteEvent | null;
  importError: string | null;

  setImportStatus: (status: ImportStatus) => void;
  setImportProgress: (progress: ImportProgressEvent) => void;
  setImportResult: (result: ImportCompleteEvent) => void;
  setImportError: (error: string) => void;
  resetImport: () => void;
}

export const useImportStore = create<ImportStore>((set) => ({
  importStatus: 'idle',
  importProgress: null,
  importResult: null,
  importError: null,

  setImportStatus: (status) => set({ importStatus: status }),
  setImportProgress: (progress) => set({ importProgress: progress }),
  setImportResult: (result) => set({ importResult: result, importStatus: 'done' }),
  setImportError: (error) => set({ importError: error, importStatus: 'error' }),
  resetImport: () =>
    set({ importStatus: 'idle', importProgress: null, importResult: null, importError: null }),
}));
