import { createSupabase, isSupabaseConfigured as check } from '@interwave/shared/supabase';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export const isSupabaseConfigured = check(url, key);

export const supabase = createSupabase(url, key, {
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
});
