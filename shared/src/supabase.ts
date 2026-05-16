import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface CreateSupabaseOptions {
  /**
   * Storage adapter for the auth session. Defaults to `globalThis.localStorage`
   * when available (browser & webapp). Pass a custom adapter for SSR / native.
   */
  storage?: Storage;
  /** Persist the session across reloads. Defaults to `true`. */
  persistSession?: boolean;
  /** Auto-refresh the access token when it expires. Defaults to `true`. */
  autoRefreshToken?: boolean;
}

/**
 * Returns true when the URL/key pair looks like a real Supabase project.
 * Mirrors the desktop app's `isSupabaseConfigured` guard so we never
 * accidentally point at the placeholder client in production.
 */
export function isSupabaseConfigured(url: string, key: string): boolean {
  return (
    Boolean(url) &&
    Boolean(key) &&
    !url.includes('placeholder') &&
    !key.includes('placeholder') &&
    url.startsWith('https://')
  );
}

/**
 * Factory for a Supabase client. Each consuming app passes its own env-derived
 * URL / anon key so the shared package stays env-agnostic. Falls back to a
 * placeholder client (matching the desktop app behavior) when values are missing,
 * so module-level imports never crash during dev / first boot.
 */
export function createSupabase(
  url: string,
  key: string,
  options: CreateSupabaseOptions = {}
): SupabaseClient {
  const storage =
    options.storage ??
    ((typeof globalThis !== 'undefined' &&
      (globalThis as unknown as { localStorage?: Storage }).localStorage) ||
      undefined);

  return createClient(
    url || 'https://placeholder.supabase.co',
    key || 'placeholder',
    {
      auth: {
        storage,
        persistSession: options.persistSession ?? true,
        autoRefreshToken: options.autoRefreshToken ?? true,
      },
    }
  );
}
