
import { create } from 'zustand';

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

export interface ToastEntry {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;

  duration: number;
}

interface ToastStore {
  toasts: ToastEntry[];
  push: (t: Omit<ToastEntry, 'id'>) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    set({ toasts: [...get().toasts, { ...t, id }] });
    if (t.duration > 0) {
      setTimeout(() => get().dismiss(id), t.duration);
    }
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  success: (title: string, body?: string) =>
    useToastStore.getState().push({ kind: 'success', title, body, duration: 2800 }),
  info: (title: string, body?: string) =>
    useToastStore.getState().push({ kind: 'info', title, body, duration: 2800 }),
  warning: (title: string, body?: string) =>
    useToastStore.getState().push({ kind: 'warning', title, body, duration: 4000 }),
  error: (title: string, body?: string) =>
    useToastStore.getState().push({ kind: 'error', title, body, duration: 5000 }),
};
