import { supabase, isSupabaseConfigured } from './supabase';
import type { Track } from './tauri';

export interface SharedSnapshot {
  id: string;
  token: string;
  owner_id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  tracks: Track[];
  created_at: string;
}

export class ShareError extends Error {
  constructor(message: string, public code: 'auth' | 'config' | 'backend' | 'notfound' | 'network') {
    super(message);
  }
}

function tokenMissing(msg: string): boolean {
  return msg.includes('does not exist') || msg.includes('relation "public.shared_playlists');
}

export async function publishPlaylistSnapshot(
  playlistName: string,
  tracks: Track[],
  description?: string,
): Promise<{ token: string; share_link: string }> {
  if (!isSupabaseConfigured) throw new ShareError('Sharing requires a Supabase backend.', 'config');
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) throw new ShareError('Sign in to share playlists.', 'auth');

  const cover = tracks.find((t) => t.thumbnail_url)?.thumbnail_url ?? null;

  try {
    const { data, error } = await supabase
      .from('shared_playlists')
      .insert({
        owner_id: session.session.user.id,
        name: playlistName,
        description: description ?? null,
        cover_url: cover,
        tracks,
      })
      .select('token')
      .single();
    if (error) throw error;
    const token = (data as any).token as string;
    return { token, share_link: `interwave://share/${token}` };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (tokenMissing(msg)) {
      throw new ShareError(
        'Sharing backend not provisioned yet — apply supabase/migrations/006_shared_playlists.sql in your Supabase Dashboard.',
        'backend',
      );
    }
    throw new ShareError(msg, 'network');
  }
}

export async function fetchSharedPlaylist(token: string): Promise<SharedSnapshot> {
  if (!isSupabaseConfigured) throw new ShareError('Sharing requires a Supabase backend.', 'config');
  const cleanToken = token.replace(/^interwave:\/\/share\//i, '').trim();
  if (!cleanToken) throw new ShareError('Invalid share link.', 'notfound');

  try {
    const { data, error } = await supabase
      .from('shared_playlists')
      .select('id, token, owner_id, name, description, cover_url, tracks, created_at')
      .eq('token', cleanToken)
      .single();
    if (error) throw error;
    return data as SharedSnapshot;
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (tokenMissing(msg)) {
      throw new ShareError('Sharing backend not provisioned yet.', 'backend');
    }
    if (msg.includes('Results contain 0 rows') || msg.includes('No rows')) {
      throw new ShareError('Share link not found — it may have been revoked.', 'notfound');
    }
    throw new ShareError(msg, 'network');
  }
}
