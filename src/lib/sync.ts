import { supabase } from './supabase';
import { getLibrary, getAllPlaylists, getPlaylist, importCloudTracks, importCloudPlaylists, importCloudPlaylistTrack } from './tauri';
import type { Track, Playlist } from './tauri';

/** Push all local SQLite data to Supabase for the signed-in user. */
export async function pushLocalDataToCloud(userId: string): Promise<void> {
  // Push tracks
  const tracks = await getLibrary();
  if (tracks.length > 0) {
    const rows = tracks.map((t: Track) => ({
      id: t.id,
      user_id: userId,
      youtube_id: t.youtube_id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration_seconds: t.duration_seconds,
      thumbnail_url: t.thumbnail_url,
      play_count: t.play_count,
      last_played_at: t.last_played_at,
      liked: t.liked,
      created_at: t.created_at,
    }));

    // Upsert in batches of 100 to avoid request size limits
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase
        .from('user_tracks')
        .upsert(batch, { onConflict: 'id,user_id' });
      if (error) console.error('sync tracks error:', error);
    }
  }

  // Push playlists
  const playlists = await getAllPlaylists();
  if (playlists.length > 0) {
    const playlistRows = playlists.map((p: Playlist) => ({
      id: p.id,
      user_id: userId,
      name: p.name,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));

    const { error: plErr } = await supabase
      .from('user_playlists')
      .upsert(playlistRows, { onConflict: 'id,user_id' });
    if (plErr) console.error('sync playlists error:', plErr);

    // Push playlist tracks
    for (const pl of playlists) {
      const plTracks = await getPlaylist(pl.id);
      if (plTracks.length > 0) {
        const ptRows = plTracks.map((t: Track, idx: number) => ({
          playlist_id: pl.id,
          track_id: t.id,
          user_id: userId,
          position: idx,
        }));
        const { error: ptErr } = await supabase
          .from('user_playlist_tracks')
          .upsert(ptRows, { onConflict: 'playlist_id,track_id,user_id' });
        if (ptErr) console.error('sync playlist tracks error:', ptErr);
      }
    }
  }
}

/**
 * Pull all cloud data for a user into local SQLite.
 * Called on sign-in so a new device immediately has the user's library.
 * Safe to call multiple times — existing local records are never overwritten.
 */
export async function pullCloudDataToLocal(userId: string): Promise<void> {
  // 1. Pull tracks
  const { data: cloudTracks, error: tErr } = await supabase
    .from('user_tracks')
    .select('*')
    .eq('user_id', userId);

  if (tErr) { console.error('pull tracks error:', tErr); }

  if (cloudTracks && cloudTracks.length > 0) {
    const tracks: Track[] = cloudTracks.map((t: any) => ({
      id: t.id,
      youtube_id: t.youtube_id,
      title: t.title,
      artist: t.artist,
      album: t.album ?? null,
      duration_seconds: t.duration_seconds ?? null,
      thumbnail_url: t.thumbnail_url ?? null,
      play_count: t.play_count ?? 0,
      last_played_at: t.last_played_at ?? null,
      liked: t.liked ?? false,
      created_at: t.created_at ?? 0,
      local_path: null,
    }));
    // Import in batches of 100
    for (let i = 0; i < tracks.length; i += 100) {
      await importCloudTracks(tracks.slice(i, i + 100));
    }
  }

  // 2. Pull playlists
  const { data: cloudPlaylists, error: pErr } = await supabase
    .from('user_playlists')
    .select('*')
    .eq('user_id', userId);

  if (pErr) { console.error('pull playlists error:', pErr); }

  if (cloudPlaylists && cloudPlaylists.length > 0) {
    const playlists: Playlist[] = cloudPlaylists.map((p: any) => ({
      id: p.id,
      name: p.name,
      created_at: p.created_at ?? 0,
      updated_at: p.updated_at ?? 0,
      spotify_id: p.spotify_id ?? null,
    }));
    await importCloudPlaylists(playlists);

    // 3. Pull playlist tracks
    const { data: cloudPtracks, error: ptErr } = await supabase
      .from('user_playlist_tracks')
      .select('playlist_id, track_id, position')
      .eq('user_id', userId)
      .order('position', { ascending: true });

    if (ptErr) { console.error('pull playlist tracks error:', ptErr); }

    if (cloudPtracks) {
      for (const pt of cloudPtracks) {
        await importCloudPlaylistTrack(pt.playlist_id, pt.track_id).catch(() => {});
      }
    }
  }
}

/** Pull cloud data summary (count of tracks, playlists) for a user. */
export async function getCloudSummary(userId: string): Promise<{ tracks: number; playlists: number }> {
  const [{ count: tracks }, { count: playlists }] = await Promise.all([
    supabase.from('user_tracks').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_playlists').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  return { tracks: tracks ?? 0, playlists: playlists ?? 0 };
}
