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

  role: AppRole;

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

    if (!isSupabaseConfigured) {
      set({ loading: false });
      return;
    }

    try {

      const timeout = new Promise<{ data: { session: null } }>((resolve) =>
        setTimeout(() => resolve({ data: { session: null } }), 6000)
      );
      const { data: { session } } = await Promise.race([
        supabase.auth.getSession(),
        timeout,
      ]);
      set({ session, user: session?.user ?? null, loading: false });

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
        logLogin();
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        set({ session, user: session?.user ?? null });
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

          if (event === 'SIGNED_IN') {
            logLogin();

            pullCloudDataToLocal(session.user.id)
              .then(() => pushLocalDataToCloud(session.user.id))
              .catch(console.error);
          }
        } else {
          set({ role: 'user', isStaff: false });
        }
      });
    } catch {

      set({ loading: false });
    }
  },
}));
