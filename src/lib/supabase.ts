import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export const isSupabaseConfigured =
  Boolean(url) &&
  Boolean(key) &&
  !url.includes('placeholder') &&
  !key.includes('placeholder') &&
  url.startsWith('https://');

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder',
  {
    auth: {
      storage: window.localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

export interface DbUserProfile {
  id: string;
  display_name: string | null;
  created_at: string;
}

export interface DbUserTrack {
  id: string;
  user_id: string;
  youtube_id: string;
  title: string;
  artist: string;
  album: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  play_count: number;
  last_played_at: number | null;
  liked: boolean;
  created_at: number;
}

export interface DbUserPlaylist {
  id: string;
  user_id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface DbUserPlaylistTrack {
  playlist_id: string;
  track_id: string;
  user_id: string;
  position: number;
}
