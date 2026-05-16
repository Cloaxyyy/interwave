import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CopySimple, Globe, MusicNote, Spinner } from '@phosphor-icons/react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

interface PublicPlaylist {
  id: string;
  owner_id: string;
  owner_name: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  updated_at: number;
  track_count: number;
}

export function Browse() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);
  const [cloned, setCloned] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const q = query.trim();
    let req = supabase
      .from('public_playlist_summary')
      .select('id,owner_id,owner_name,name,description,cover_url,updated_at,track_count')
      .order('updated_at', { ascending: false })
      .limit(60);
    if (q) {
      // ilike on name OR owner_name
      req = req.or(`name.ilike.%${q}%,owner_name.ilike.%${q}%`);
    }

    req.then(({ data, error: e }) => {
      if (cancelled) return;
      if (e) {
        const msg = String(e?.message ?? e);
        const missing = msg.includes('public_playlist_summary') || msg.includes('does not exist');
        setError(
          missing
            ? 'Browse not provisioned yet — apply supabase/migrations/008_playlist_visibility.sql in your Supabase Dashboard → SQL Editor.'
            : msg,
        );
      } else {
        setResults((data ?? []) as PublicPlaylist[]);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [query]);

  const clone = async (pl: PublicPlaylist) => {
    if (!user || cloning) return;
    setCloning(pl.id);
    try {
      // 1. Fetch source playlist tracks
      const { data: ptRows, error: ptErr } = await supabase
        .from('user_playlist_tracks')
        .select('track_id, position')
        .eq('playlist_id', pl.id)
        .eq('user_id', pl.owner_id)
        .order('position', { ascending: true });
      if (ptErr) throw ptErr;

      const trackIds = (ptRows ?? []).map((r) => r.track_id);
      let srcTracks: any[] = [];
      if (trackIds.length > 0) {
        const { data: tRows, error: tErr } = await supabase
          .from('user_tracks')
          .select('id,youtube_id,title,artist,album,duration_seconds,thumbnail_url')
          .eq('user_id', pl.owner_id)
          .in('id', trackIds);
        if (tErr) throw tErr;
        srcTracks = tRows ?? [];
      }

      // 2. Map source track ids → new ids unique to viewer (avoid PK clash on (id,user_id))
      const nowSec = Math.floor(Date.now() / 1000);
      const idMap = new Map<string, string>();
      const newTrackRows = srcTracks.map((t: any) => {
        const newId =
          (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.() ??
          `${t.youtube_id}-${nowSec}-${Math.random().toString(36).slice(2, 8)}`;
        idMap.set(t.id, newId);
        return {
          id: newId,
          user_id: user.id,
          youtube_id: t.youtube_id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration_seconds: t.duration_seconds,
          thumbnail_url: t.thumbnail_url,
          play_count: 0,
          last_played_at: null,
          liked: false,
          created_at: nowSec,
        };
      });

      if (newTrackRows.length > 0) {
        // Upsert in batches of 100
        for (let i = 0; i < newTrackRows.length; i += 100) {
          const batch = newTrackRows.slice(i, i + 100);
          const { error: tInsErr } = await supabase.from('user_tracks').insert(batch);
          if (tInsErr) throw tInsErr;
        }
      }

      // 3. Insert new playlist row
      const newPlId =
        (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.() ??
        `cloned-${pl.id}-${nowSec}`;
      const { error: plInsErr } = await supabase.from('user_playlists').insert({
        id: newPlId,
        user_id: user.id,
        name: pl.name,
        description: pl.description,
        cover_url: pl.cover_url,
        visibility: 'private',
        created_at: nowSec,
        updated_at: nowSec,
      });
      if (plInsErr) throw plInsErr;

      // 4. Insert playlist track rows with mapped ids
      if (ptRows && ptRows.length > 0) {
        const newPtRows = ptRows
          .map((r: { track_id: string; position: number }) => {
            const newTid = idMap.get(r.track_id);
            if (!newTid) return null;
            return {
              playlist_id: newPlId,
              track_id: newTid,
              user_id: user.id,
              position: r.position,
            };
          })
          .filter((r): r is { playlist_id: string; track_id: string; user_id: string; position: number } => !!r);
        if (newPtRows.length > 0) {
          for (let i = 0; i < newPtRows.length; i += 100) {
            const batch = newPtRows.slice(i, i + 100);
            const { error: ptInsErr } = await supabase.from('user_playlist_tracks').insert(batch);
            if (ptInsErr) throw ptInsErr;
          }
        }
      }

      setCloned((prev) => new Set(prev).add(pl.id));
    } catch (e) {
      alert('Could not clone playlist: ' + String((e as Error)?.message ?? e));
    } finally {
      setCloning(null);
    }
  };

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
            Browse <em>public</em>
          </h1>
          <p className="iw-sub-sm">Public playlists shared by the community.</p>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search public playlists by name or owner…"
          className="iw-input"
        />

        {loading && <div className="iw-empty">Loading…</div>}
        {error && <div className="iw-error">{error}</div>}

        {!loading && !error && (
          <ul className="iw-grid" role="list">
            {results.length === 0 ? (
              <li className="iw-empty">
                {query ? `No public playlists matched "${query}".` : 'No public playlists yet — be the first!'}
              </li>
            ) : (
              results.map((pl) => {
                const isCloned = cloned.has(pl.id);
                const isCloning = cloning === pl.id;
                return (
                  <li key={pl.id} className="iw-pl-card iw-pl-card-public">
                    <Link to={`/playlist/${pl.id}`} className="iw-pl-link">
                      <div className="iw-pl-art-fallback">
                        {pl.cover_url ? (
                          <img src={pl.cover_url} alt="" draggable={false} />
                        ) : (
                          <MusicNote size={28} weight="duotone" />
                        )}
                      </div>
                      <div className="iw-pl-name">{pl.name}</div>
                      <div className="iw-pl-meta">
                        <Globe size={10} weight="bold" /> {pl.owner_name} · {pl.track_count} track{pl.track_count === 1 ? '' : 's'}
                      </div>
                    </Link>
                    <button
                      type="button"
                      className="iw-btn iw-btn-ghost iw-btn-sm iw-pl-clone"
                      onClick={() => clone(pl)}
                      disabled={isCloning || isCloned || pl.owner_id === user?.id}
                      title={
                        pl.owner_id === user?.id
                          ? "This is your own playlist"
                          : isCloned
                          ? "Cloned to your library"
                          : "Clone into your library"
                      }
                    >
                      {isCloning ? (
                        <>
                          <Spinner size={12} weight="bold" className="iw-spin" />
                          Cloning…
                        </>
                      ) : isCloned ? (
                        <>✓ Cloned</>
                      ) : (
                        <>
                          <CopySimple size={12} weight="bold" />
                          Clone
                        </>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
