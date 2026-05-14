// Cmd/Ctrl+K palette: fuzzy-jump to views, playlists, library tracks,
// or YouTube search results.

import { useEffect, useMemo, useState, useRef } from 'react';
import { useUiStore } from '../../stores/uiStore';
import {
  getLibrary, getAllPlaylists, playTrack, searchYoutube,
  type Track, type Playlist, type SearchResult,
} from '../../lib/tauri';

type Action = {
  id: string;
  kind: 'view' | 'track' | 'playlist' | 'control' | 'youtube';
  label: string;
  sublabel?: string;
  thumbnail?: string | null;
  hint?: string;
  run: () => void | Promise<void>;
};

// Subsequence fuzzy match — lower score = better. undefined = no match.
function fuzzyScore(text: string, query: string): number | undefined {
  if (!query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let ti = 0, score = 0, lastHit = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    while (ti < t.length && t[ti] !== ch) ti++;
    if (ti >= t.length) return undefined;
    score += ti - lastHit; // gap penalty: contiguous = small score
    lastHit = ti;
    ti++;
  }
  return score;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [ytResults, setYtResults] = useState<SearchResult[]>([]);
  const [ytLoading, setYtLoading] = useState(false);
  const ytDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setActivePlaylist = useUiStore((s) => s.setActivePlaylist);
  const libraryVersion = useUiStore((s) => s.libraryVersion);

  // Toggle on Cmd/Ctrl+K from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
    }
  }, [open]);

  // Refresh library/playlists when opening or when the library changes
  useEffect(() => {
    if (!open) return;
    getLibrary().then(setTracks).catch(() => {});
    getAllPlaylists().then(setPlaylists).catch(() => {});
  }, [open, libraryVersion]);

  // Debounced YouTube search (350ms, 3+ chars).
  useEffect(() => {
    if (ytDebounce.current) clearTimeout(ytDebounce.current);
    const q = query.trim();
    if (q.length < 3) {
      setYtResults([]);
      setYtLoading(false);
      return;
    }
    setYtLoading(true);
    ytDebounce.current = setTimeout(() => {
      searchYoutube(q)
        .then((r) => setYtResults(r.slice(0, 6)))
        .catch(() => setYtResults([]))
        .finally(() => setYtLoading(false));
    }, 350);
    return () => { if (ytDebounce.current) clearTimeout(ytDebounce.current); };
  }, [query]);

  // Build the full action list.
  const allActions: Action[] = useMemo(() => {
    const views: Action[] = [
      { id: 'view:home',     kind: 'view', label: 'Go to Home',     hint: '↵', run: () => setActiveView('home') },
      { id: 'view:library',  kind: 'view', label: 'Go to Library',  hint: '↵', run: () => setActiveView('library') },
      { id: 'view:liked',    kind: 'view', label: 'Go to Liked Songs', hint: '↵', run: () => setActiveView('liked') },
      { id: 'view:search',   kind: 'view', label: 'Open Search',    hint: '↵', run: () => setActiveView('search') },
      { id: 'view:queue',    kind: 'view', label: 'Open Queue',     hint: '↵', run: () => setActiveView('queue') },
      { id: 'view:import',   kind: 'view', label: 'Import from Spotify', hint: '↵', run: () => setActiveView('import') },
      { id: 'view:profile',  kind: 'view', label: 'Open Profile',   hint: '↵', run: () => setActiveView('profile') },
      { id: 'view:settings', kind: 'view', label: 'Open Settings',  hint: '↵', run: () => setActiveView('settings') },
    ];
    const trackActions: Action[] = tracks.map((t) => ({
      id: `track:${t.id}`,
      kind: 'track',
      label: t.title,
      sublabel: t.artist,
      thumbnail: t.thumbnail_url,
      hint: 'Play',
      run: () => playTrack({
        video_id: t.youtube_id,
        title: t.title,
        artist: t.artist,
        duration_seconds: t.duration_seconds,
        thumbnail_url: t.thumbnail_url,
      }),
    }));
    const playlistActions: Action[] = playlists.map((p) => ({
      id: `pl:${p.id}`,
      kind: 'playlist',
      label: p.name,
      sublabel: 'Playlist',
      hint: '↵',
      run: () => setActivePlaylist(p.id, p.name),
    }));
    const youtubeActions: Action[] = ytResults.map((r) => ({
      id: `yt:${r.youtube_id}`,
      kind: 'youtube',
      label: r.title,
      sublabel: r.artist,
      thumbnail: r.thumbnail_url,
      hint: 'Play',
      run: () => playTrack({
        video_id: r.youtube_id,
        title: r.title,
        artist: r.artist,
        duration_seconds: r.duration_seconds,
        thumbnail_url: r.thumbnail_url,
      }),
    }));
    return [...views, ...playlistActions, ...trackActions, ...youtubeActions];
  }, [tracks, playlists, ytResults, setActiveView, setActivePlaylist]);

  // Filter + rank
  const filtered: Action[] = useMemo(() => {
    if (!query.trim()) {
      // Empty query: just show all view shortcuts at the top
      return allActions.slice(0, 8);
    }
    const scored = allActions
      .map((a) => {
        const labelScore = fuzzyScore(a.label, query);
        const subScore = a.sublabel ? fuzzyScore(a.sublabel, query) : undefined;
        // Best of label/sublabel, but label match preferred
        const score = labelScore !== undefined && subScore !== undefined
          ? Math.min(labelScore, subScore + 5)
          : labelScore ?? subScore;
        return score === undefined ? null : { a, score };
      })
      .filter((x): x is { a: Action; score: number } => x !== null);
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, 30).map((x) => x.a);
  }, [allActions, query]);

  // Keep highlight in range when filtered list changes
  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(0);
  }, [filtered.length, highlight]);

  if (!open) return null;

  const runAt = (idx: number) => {
    const a = filtered[idx];
    if (!a) return;
    setOpen(false);
    Promise.resolve(a.run()).catch(console.error);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(highlight);
    }
  };

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        paddingTop: '12vh', animation: 'fadeIn 120ms ease',
      }}
    >
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 92vw)', maxHeight: '70vh',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          boxShadow: '0 30px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
          onKeyDown={onInputKey}
          placeholder="Jump to anything…  ↑↓  ↵  Esc"
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif',
            fontSize: 16, padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        />
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: '32px 20px', color: 'var(--text-muted)',
              fontFamily: 'var(--sans)', fontSize: 13, textAlign: 'center',
            }}>
              {ytLoading
                ? 'Searching YouTube…'
                : query.trim().length >= 3
                  ? 'No matches — try a different query.'
                  : 'Type to search your library, or 3+ characters to also search YouTube.'}
            </div>
          ) : (
            filtered.map((a, i) => (
              <div
                key={a.id}
                onClick={() => runAt(i)}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 16px',
                  background: i === highlight ? 'var(--bg-overlay)' : 'transparent',
                  cursor: 'pointer',
                  borderLeft: i === highlight
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
                }}
              >
                {a.thumbnail
                  ? <div style={{
                      width: 32, height: 32, borderRadius: 4,
                      background: `center/cover url(${a.thumbnail})`,
                      flexShrink: 0,
                    }}/>
                  : <div style={{
                      width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                      background: 'var(--bg-overlay)',
                      display: 'grid', placeItems: 'center',
                      color: 'var(--text-muted)', fontSize: 14,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}>
                      {a.kind === 'view' ? '◇' : a.kind === 'playlist' ? '≡' : '♪'}
                    </div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{a.label}</div>
                  {a.sublabel && (
                    <div style={{
                      fontFamily: 'Syne, sans-serif', fontSize: 11,
                      color: 'var(--text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{a.sublabel}</div>
                  )}
                </div>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  color: i === highlight ? 'var(--accent)' : 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {a.kind}
                </span>
              </div>
            ))
          )}
        </div>
        <div style={{
          padding: '8px 16px', borderTop: '1px solid var(--border-subtle)',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          color: 'var(--text-muted)',
          display: 'flex', gap: 14,
        }}>
          <span><kbd style={kbdStyle}>↑</kbd> <kbd style={kbdStyle}>↓</kbd> navigate</span>
          <span><kbd style={kbdStyle}>↵</kbd> select</span>
          <span><kbd style={kbdStyle}>esc</kbd> close</span>
          <span style={{ marginLeft: 'auto' }}>{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  background: 'var(--bg-overlay)',
  border: '1px solid var(--border-default)',
  borderRadius: 3,
  padding: '0 5px',
  fontSize: 9,
  color: 'var(--text-secondary)',
};
