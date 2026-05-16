import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MusicNote, Play, Playlist as PlaylistIcon, SpeakerHigh } from '@phosphor-icons/react';
import { useAuthStore } from '../stores/authStore';
import { usePlayerStore } from '../stores/playerStore';
import { supabase } from '../lib/supabase';

interface Track {
  id: string;
  youtube_id: string;
  title: string;
  artist: string;
  album: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  liked: boolean;
  last_played_at: number | null;
  play_count: number;
}

interface Playlist {
  id: string;
  name: string;
  updated_at: number;
}

type Tab = 'tracks' | 'liked' | 'playlists';

export function Library() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const [tab, setTab] = useState<Tab>('tracks');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      supabase
        .from('user_tracks')
        .select('id,youtube_id,title,artist,album,duration_seconds,thumbnail_url,liked,last_played_at,play_count')
        .eq('user_id', user.id)
        .order('last_played_at', { ascending: false, nullsFirst: false })
        .limit(500),
      supabase
        .from('user_playlists')
        .select('id,name,updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
    ])
      .then(([tracksRes, playlistsRes]) => {
        if (cancelled) return;
        if (tracksRes.error) throw tracksRes.error;
        if (playlistsRes.error) throw playlistsRes.error;
        setTracks((tracksRes.data ?? []) as Track[]);
        setPlaylists((playlistsRes.data ?? []) as Playlist[]);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = String(e?.message ?? e);
        const tableMissing = msg.includes('does not exist') || msg.includes('relation');
        setError(
          tableMissing
            ? 'Library tables not provisioned yet — apply supabase/migrations/007_user_library.sql in your Supabase Dashboard → SQL Editor, then sign into the desktop app once to push your library.'
            : msg,
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const liked = tracks.filter((t) => t.liked);
  const visibleTracks = tab === 'liked' ? liked : tracks;

  return (
    <div className="iw-shell">
      <header className="iw-header">
        <Link className="iw-brand" to="/dashboard">
          <span className="iw-wordmark">
            inter<em>wave</em>
          </span>
        </Link>
        <button type="button" className="iw-btn iw-btn-ghost iw-btn-sm" onClick={signOut}>
          Sign out
        </button>
      </header>

      <main className="iw-main">
        <div className="iw-lib-head">
          <h1 className="iw-title-sm">
            Your <em>library</em>
          </h1>
          <p className="iw-sub-sm">Synced from your devices.</p>
        </div>

        <nav className="iw-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'tracks'}
            className={`iw-tab ${tab === 'tracks' ? 'iw-tab-active' : ''}`}
            onClick={() => setTab('tracks')}
          >
            <MusicNote size={14} weight="bold" />
            Tracks
            <span className="iw-tab-count">{tracks.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'liked'}
            className={`iw-tab ${tab === 'liked' ? 'iw-tab-active' : ''}`}
            onClick={() => setTab('liked')}
          >
            <Heart size={14} weight="bold" />
            Liked
            <span className="iw-tab-count">{liked.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'playlists'}
            className={`iw-tab ${tab === 'playlists' ? 'iw-tab-active' : ''}`}
            onClick={() => setTab('playlists')}
          >
            <PlaylistIcon size={14} weight="bold" />
            Playlists
            <span className="iw-tab-count">{playlists.length}</span>
          </button>
        </nav>

        {loading && <div className="iw-empty">Loading your library…</div>}

        {error && <div className="iw-error">{error}</div>}

        {!loading && !error && tab !== 'playlists' && (
          <>
            {visibleTracks.length > 0 && (
              <div className="iw-list-actions">
                <button
                  type="button"
                  className="iw-btn iw-btn-primary iw-btn-sm"
                  onClick={() => {
                    void usePlayerStore.getState().playQueue(visibleTracks);
                  }}
                >
                  <Play size={14} weight="fill" />
                  Play all
                </button>
              </div>
            )}
            <ul className="iw-list" role="list">
              {visibleTracks.length === 0 ? (
                <li className="iw-empty">
                  {tab === 'liked'
                    ? "You haven't liked anything yet."
                    : 'Your library is empty. Sign into the desktop app and play some tracks to populate it.'}
                </li>
              ) : (
                visibleTracks.map((t, i) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    onPlay={() => { void usePlayerStore.getState().playQueue(visibleTracks, i); }}
                  />
                ))
              )}
            </ul>
          </>
        )}

        {!loading && !error && tab === 'playlists' && (
          <ul className="iw-grid" role="list">
            {playlists.length === 0 ? (
              <li className="iw-empty">
                No playlists yet. Create some on the desktop app — they'll sync here.
              </li>
            ) : (
              playlists.map((p) => (
                <li key={p.id} className="iw-pl-card">
                  <div className="iw-pl-art-fallback">
                    <PlaylistIcon size={28} weight="duotone" />
                  </div>
                  <div className="iw-pl-name">{p.name}</div>
                  <div className="iw-pl-meta">
                    Updated {new Date(p.updated_at * 1000).toLocaleDateString()}
                  </div>
                </li>
              ))
            )}
          </ul>
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
        aria-label={`Play ${track.title} by ${track.artist}`}
      >
        <div className="iw-row-art">
          {track.thumbnail_url ? (
            <img src={track.thumbnail_url} alt="" loading="lazy" draggable={false} />
          ) : (
            <MusicNote size={18} weight="duotone" />
          )}
          {isCurrent && (
            <div className="iw-row-art-overlay" aria-hidden="true">
              {isPlaying ? <SpeakerHigh size={16} weight="fill" /> : <Play size={16} weight="fill" />}
            </div>
          )}
        </div>
        <div className="iw-row-meta">
          <div className="iw-row-title">{track.title}</div>
          <div className="iw-row-artist">{track.artist}</div>
        </div>
        {track.liked && <Heart size={14} weight="fill" className="iw-row-like" />}
        <div className="iw-row-dur">
          {dur > 0 ? `${m}:${s}` : ''}
        </div>
      </button>
    </li>
  );
}
