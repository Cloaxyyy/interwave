import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { usePlayerStore } from './playerStore';

interface AuthStore {
  session: Session | null;
  user: User | null;
  displayName: string | null;
  loading: boolean;
  initialized: boolean;

  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

function deriveDisplayName(user: User | null | undefined): string | null {
  if (!user) return null;
  const meta = (user.user_metadata?.display_name as string | undefined) ?? null;
  return meta ?? user.email ?? null;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  user: null,
  displayName: null,
  loading: true,
  initialized: false,

  signOut: async () => {
    await supabase.auth.signOut();
    // Stop any in-flight playback so audio doesn't keep going after sign-out.
    usePlayerStore.getState().reset();
    set({ session: null, user: null, displayName: null });
  },

  initialize: async () => {
    if (get().initialized) return;
    set({ initialized: true });

    if (!isSupabaseConfigured) {
      // Surface this loudly in the console so first-time devs notice missing env vars.
      console.warn(
        '[interwave/webapp] Supabase env vars missing — sign-in will not work. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
      set({ loading: false });
      return;
    }

    try {
      // Soft timeout so a flaky network never wedges the loading splash.
      const timeout = new Promise<{ data: { session: null } }>((resolve) =>
        setTimeout(() => resolve({ data: { session: null } }), 6000)
      );
      const { data: { session } } = await Promise.race([
        supabase.auth.getSession(),
        timeout,
      ]);

      set({
        session,
        user: session?.user ?? null,
        displayName: deriveDisplayName(session?.user),
        loading: false,
      });

      supabase.auth.onAuthStateChange((_event, nextSession) => {
        set({
          session: nextSession,
          user: nextSession?.user ?? null,
          displayName: deriveDisplayName(nextSession?.user),
        });
      });
    } catch (err) {
      console.error('[interwave/webapp] auth init failed', err);
      set({ loading: false });
    }
  },
}));
