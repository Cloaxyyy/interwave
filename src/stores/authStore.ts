import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { pushLocalDataToCloud, pullCloudDataToLocal } from '../lib/sync';
import { getMyRole, logLogin, type AppRole, isStaff } from '../lib/admin';

interface AuthStore {
  session: Session | null;
  user: User | null;
  displayName: string | null;
  loading: boolean;
  /** Cached app role for the current user. 'user' until the first lookup. */
  role: AppRole;
  /** Quick boolean — true for moderator/developer/founder. */
  isStaff: boolean;

  setSession: (session: Session | null) => void;
  setDisplayName: (name: string) => void;
  setRole: (role: AppRole) => void;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user: null,
  displayName: null,
  loading: true,
  role: 'user',
  isStaff: false,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      loading: false,
    }),

  setDisplayName: (displayName) => set({ displayName }),

  setRole: (role) => set({ role, isStaff: isStaff(role) }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, displayName: null, role: 'user', isStaff: false });
  },

  initialize: async () => {
    // If Supabase isn't configured (placeholder credentials), skip auth entirely.
    // The app runs in local-only mode — all features work via local SQLite.
    if (!isSupabaseConfigured) {
      set({ loading: false });
      return;
    }

    try {
      // Reads from localStorage — no network call if no session is stored.
      // Race against a 6-second timeout so a network hiccup can't freeze the app.
      const timeout = new Promise<{ data: { session: null } }>((resolve) =>
        setTimeout(() => resolve({ data: { session: null } }), 6000)
      );
      const { data: { session } } = await Promise.race([
        supabase.auth.getSession(),
        timeout,
      ]);
      set({ session, user: session?.user ?? null, loading: false });

      // Fetch display name + admin role if logged in
      if (session?.user) {
        const { data } = await supabase
          .from('user_profiles')
          .select('display_name')
          .eq('id', session.user.id)
          .single();
        const name =
          data?.display_name ??
          (session.user.user_metadata?.display_name as string | undefined) ??
          null;
        if (name) set({ displayName: name });

        getMyRole().then((role) => set({ role, isStaff: isStaff(role) })).catch(() => {});
        logLogin();   // record IP + user-agent for admin lookups
      }

      // Listen for auth state changes (token refresh, sign in from another tab, etc.)
      supabase.auth.onAuthStateChange(async (event, session) => {
        set({ session, user: session?.user ?? null });
        if (session?.user) {
          // Fetch display name — fall back to user_metadata if row not yet created
          const { data } = await supabase
            .from('user_profiles')
            .select('display_name')
            .eq('id', session.user.id)
            .single();
          const name =
            data?.display_name ??
            (session.user.user_metadata?.display_name as string | undefined) ??
            null;
          if (name) set({ displayName: name });

          // Refresh role on every auth state change
          getMyRole().then((role) => set({ role, isStaff: isStaff(role) })).catch(() => {});

          // Sync local data to cloud on sign-in
          if (event === 'SIGNED_IN') {
            logLogin();
            // Pull cloud data first so existing library appears immediately,
            // then push any local-only tracks up to the cloud.
            pullCloudDataToLocal(session.user.id)
              .then(() => pushLocalDataToCloud(session.user.id))
              .catch(console.error);
          }
        } else {
          set({ role: 'user', isStaff: false });
        }
      });
    } catch {
      // Supabase unreachable — fall back to local-only mode silently.
      set({ loading: false });
    }
  },
}));
