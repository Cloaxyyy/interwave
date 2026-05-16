import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Globe,
  Heart,
  Lock,
  MusicNote,
  Play,
  SpeakerHigh,
  Trash,
} from '@phosphor-icons/react';
import { useAuthStore } from '../stores/authStore';
import { usePlayerStore } from '../stores/playerStore';
import { supabase } from '../lib/supabase';

interface Track {
  id: string;
  youtube_id: string;
  title: string;
  artist: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  liked: boolean;
}

interface PlaylistRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  visibility: 'private' | 'public';
  updated_at: number;
}

export function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const [playlist, setPlaylist] = useState<PlaylistRow | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwner = !!playlist && !!user && playlist.user_id === user.id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data: plRows, error: plErr } = await supabase
          .from('user_playlists')
          .select('id,user_id,name,description,cover_url,visibility,updated_at')
          .eq('id', id)
          .limit(1);
        if (plErr) throw plErr;
        const pl = plRows?.[0] as PlaylistRow | undefined;
        if (!pl) throw new Error('Playlist not found, or you don\'t have access.');

        const { data: ptRows, error: ptErr } = await supabase
          .from('user_playlist_tracks')
          .select('track_id, position')
          .eq('playlist_id', pl.id)
          .eq('user_id', pl.user_id)
          .order('position', { ascending: true });
        if (ptErr) throw ptErr;

        const trackIds = (ptRows ?? []).map((r) => r.track_id);
        let trackList: Track[] = [];
        if (trackIds.length > 0) {
          const { data: tRows, error: tErr } = await supabase
            .from('user_tracks')
            .select('id,youtube_id,title,artist,duration_seconds,thumbnail_url,liked')
            .eq('user_id', pl.user_id)
            .in('id', trackIds);
          if (tErr) throw tErr;
          const byId = new Map<string, Track>();
          for (const t of (tRows ?? []) as Track[]) byId.set(t.id, t);
          trackList = trackIds
            .map((tid) => byId.get(tid))
            .filter((t): t is Track => !!t);
        }

        if (cancelled) return;
        setPlaylist(pl);
        setTracks(trackList);
      } catch (e) {
        if (cancelled) return;
        const msg = String((e as Error)?.message ?? e);
        const missingCol = msg.includes('column') && msg.includes('visibility');
        setError(
          missingCol
            ? 'Playlist visibility columns missing — apply supabase/migrations/008_playlist_visibility.sql in your Supabase Dashboard → SQL Editor.'
            : msg,
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const playAll = () => {
    if (tracks.length === 0) return;
    void usePlayerStore.getState().playQueue(tracks);
  };

  const toggleVisibility = async () => {
    if (!playlist || !isOwner) return;
    const next = playlist.visibility === 'public' ? 'private' : 'public';
    setBusy(true);
    const { error: e } = await supabase
      .from('user_playlists')
      .update({ visibility: next })
      .eq('id', playlist.id)
      .eq('user_id', playlist.user_id);
    setBusy(false);
    if (e) {
      alert('Could not update visibility: ' + e.message);
      return;
    }
    setPlaylist({ ...playlist, visibility: next });
  };

  const deletePlaylist = async () => {
    if (!playlist || !isOwner) return;
    const ok = confirm(`Delete "${playlist.name}"? Tracks remain in your library — only the playlist is removed.`);
    if (!ok) return;
    setBusy(true);
    const { error: e } = await supabase
      .from('user_playlists')
      .delete()
      .eq('id', playlist.id)
      .eq('user_id', playlist.user_id);
    setBusy(false);
    if (e) {
      alert('Could not delete: ' + e.message);
      return;
    }
    navigate('/library', { replace: true });
  };

  return (
    <div className="iw-shell">
      <header className="iw-header">
        <Link className="iw-brand" to="/library">
          <span className="iw-wordmark">
            inter<em>wave</em>
          </span>
        </Link>
        <button type="button" className="iw-btn iw-btn-ghost iw-btn-sm" onClick={signOut}>
          Sign out
        </button>
      </header>

      <main className="iw-main">
        <Link to="/library" className="iw-back-link">← Library</Link>

        {loading && <div className="iw-empty">Loading playlist…</div>}
        {error && <div className="iw-error">{error}</div>}

        {!loading && !error && playlist && (
          <>
            <div className="iw-pl-hero">
              <div className="iw-pl-hero-art">
                {playlist.cover_url ? (
                  <img src={playlist.cover_url} alt="" draggable={false} />
                ) : tracks[0]?.thumbnail_url ? (
                  <img src={tracks[0].thumbnail_url} alt="" draggable={false} />
                ) : (
                  <MusicNote size={36} weight="duotone" />
                )}
              </div>
              <div className="iw-pl-hero-meta">
                <div className="iw-pl-hero-kicker">
                  {playlist.visibility === 'public' ? (
                    <><Globe size={11} weight="bold" /> PUBLIC PLAYLIST</>
                  ) : (
                    <><Lock size={11} weight="bold" /> PRIVATE PLAYLIST</>
                  )}
                </div>
                <h1 className="iw-title-sm">{playlist.name}</h1>
                {playlist.description && (
                  <p className="iw-sub-sm" style={{ marginTop: 6 }}>{playlist.description}</p>
                )}
                <div className="iw-pl-hero-stats">
                  {tracks.length} track{tracks.length === 1 ? '' : 's'} · updated{' '}
                  {new Date(playlist.updated_at * 1000).toLocaleDateString()}
                </div>
                <div className="iw-pl-hero-actions">
                  <button
                    type="button"
                    className="iw-btn iw-btn-primary iw-btn-sm"
                    onClick={playAll}
                    disabled={tracks.length === 0}
                  >
                    <Play size={14} weight="fill" />
                    Play
                  </button>
                  {isOwner && (
                    <>
                      <button
                        type="button"
                        className="iw-btn iw-btn-ghost iw-btn-sm"
                        onClick={toggleVisibility}
                        disabled={busy}
                        title={playlist.visibility === 'public' ? 'Make private' : 'Make public'}
                      >
                        {playlist.visibility === 'public' ? (
                          <><Lock size={13} weight="bold" /> Make private</>
                        ) : (
                          <><Globe size={13} weight="bold" /> Make public</>
                        )}
                      </button>
                      <button
                        type="button"
                        className="iw-btn iw-btn-danger iw-btn-sm"
                        onClick={deletePlaylist}
                        disabled={busy}
                      >
                        <Trash size={13} weight="bold" /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <ul className="iw-list" role="list">
              {tracks.length === 0 ? (
                <li className="iw-empty">This playlist is empty.</li>
              ) : (
                tracks.map((t, i) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    onPlay={() => { void usePlayerStore.getState().playQueue(tracks, i); }}
                  />
                ))
              )}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

function TrackRow({ track, onPlay }: { track: Track; onPlay: () => void }) {
  const dur = track.duration_seconds ?? 0;
  const m = Math.floor(dur / 60);
  const s = String(dur % 60).padStart(2, '0');
  const currentId = usePlayerStore((st) => st.currentTrack?.id ?? null);
  const playerState = usePlayerStore((st) => st.state);
  const isCurrent = currentId === track.id;
  const isPlaying = isCurrent && playerState === 'playing';
  return (
    <li>
      <button
        type="button"
        className={`iw-row ${isCurrent ? 'iw-row-playing' : ''}`}
        onClick={onPlay}
      >
        <div className="iw-row-art">
          {track.thumbnail_url ? (
            <img src={track.thumbnail_url} alt="" loading="lazy" draggable={false} />
          ) : (
            <MusicNote size={18} weight="duotone" />
          )}
          {isPlaying && (
            <span className="iw-row-art-overlay">
              <SpeakerHigh size={14} weight="fill" />
            </span>
          )}
        </div>
        <div className="iw-row-meta">
          <div className="iw-row-title">{track.title}</div>
          <div className="iw-row-artist">{track.artist}</div>
        </div>
        {track.liked && <Heart size={14} weight="fill" className="iw-row-like" />}
        <div className="iw-row-dur">{dur > 0 ? `${m}:${s}` : ''}</div>
      </button>
    </li>
  );
}
