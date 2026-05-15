import { useEffect, useRef, useState, useMemo } from 'react';
import { useSearchStore } from '../stores/searchStore';
import { usePlayerStore } from '../stores/playerStore';
import { useUiStore } from '../stores/uiStore';
import { searchYoutube, getSearchHistory, playTrack, setQueue } from '../lib/tauri';
import type { SearchResult } from '../lib/tauri';
import SearchResultItem from '../components/search/SearchResultItem';
import RecentSearches from '../components/search/RecentSearches';
import { CircleNotch, MagnifyingGlass, X as XIcon } from '@phosphor-icons/react';

type Filter = 'all' | 'songs' | 'artists';

const DEBOUNCE_MS = 500;

const SPIN_KEYFRAME = `@keyframes spin { to { transform: rotate(360deg); } }`;

export default function SearchView() {
  const { query, results, status, error, setResults, setStatus, setError, setRecentSearches, setQuery } =
    useSearchStore();
  const { currentTrack, playbackState } = usePlayerStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const uniqueArtists = useMemo(() => {
    const counts = new Map<string, { name: string; count: number; firstResult: SearchResult }>();
    for (const r of results) {
      const a = r.artist?.trim();
      if (!a || a === 'Unknown') continue;
      const cur = counts.get(a) ?? { name: a, count: 0, firstResult: r };
      cur.count++;
      counts.set(a, cur);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [results]);

  const visibleResults = filter === 'artists' ? [] : results;

  useEffect(() => {
    getSearchHistory()
      .then(setRecentSearches)
      .catch(() => {});

    requestAnimationFrame(() => inputRef.current?.focus());
  }, [setRecentSearches]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setStatus('idle');
      return;
    }

    setStatus('loading');
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchYoutube(query);
        setResults(data);
        setStatus('done');
        setError(null);

        const recents = await getSearchHistory();
        setRecentSearches(recents);
      } catch (err) {
        setError(String(err));
        setStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, setResults, setStatus, setError, setRecentSearches]);

  const handlePlay = async (result: SearchResult): Promise<void> => {

    const idx = results.findIndex((r) => r.youtube_id === result.youtube_id);
    const after = results.slice(idx + 1).map((r) => ({
      id: r.youtube_id,
      youtube_id: r.youtube_id,
      title: r.title,
      artist: r.artist,
      album: null,
      duration_seconds: r.duration_seconds,
      thumbnail_url: r.thumbnail_url,
      play_count: 0,
      last_played_at: null,
      liked: false,
      created_at: 0,
      local_path: null,
    }));
    await Promise.all([
      playTrack({
        video_id: result.youtube_id,
        title: result.title,
        artist: result.artist,
        duration_seconds: result.duration_seconds,
        thumbnail_url: result.thumbnail_url,
      }),
      after.length > 0 ? setQueue(after) : Promise.resolve(),
    ]);
  };

  const handleRecentSelect = (q: string) => {
    setQuery(q);
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {}
      <div
        style={{
          padding: '24px 28px 18px',
          borderBottom: '1px solid var(--seam)',
          background: 'linear-gradient(180deg, var(--tint-8) 0%, transparent 100%)',
          flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <h1 style={{
          fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 400,
          letterSpacing: '-0.02em', margin: 0, color: 'var(--text-primary)',
          lineHeight: 1,
        }}>
          Search
        </h1>

        {}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--bg-elevated)',
          border: `1px solid ${query.trim() ? 'var(--accent-live)' : 'var(--border-default)'}`,
          borderRadius: 10,
          padding: '10px 14px',
          maxWidth: 640,
          transition: 'border-color 200ms ease, box-shadow 200ms ease',
          boxShadow: query.trim()
            ? '0 0 0 4px color-mix(in oklch, var(--accent-live) 12%, transparent)'
            : 'none',
        }}>
          <MagnifyingGlass size={18} weight="bold" color="var(--text-secondary)"/>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Songs, artists, anything…"
            spellCheck={false}
            autoComplete="off"
            style={{
              flex: 1,
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--sans)', fontSize: 15,
            }}
          />
          {query.trim() && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              title="Clear"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 4,
                display: 'grid', placeItems: 'center',
              }}
            >
              <XIcon size={14} weight="bold"/>
            </button>
          )}
        </div>

        {}
        {query.trim() && (
          <p style={{
            fontFamily: 'var(--mono)', fontSize: 11,
            color: 'var(--text-muted)', letterSpacing: '0.05em',
            margin: 0,
          }}>
            {status === 'loading'
              ? `Searching YouTube for "${query}"…`
              : status === 'done'
                ? `${results.length} result${results.length === 1 ? '' : 's'} for "${query}"`
                : status === 'error'
                  ? `Search failed`
                  : ''}
          </p>
        )}

        {}
        {status === 'done' && results.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {([
              { id: 'all',     label: `All` },
              { id: 'songs',   label: `Songs (${results.length})` },
              { id: 'artists', label: `Artists (${uniqueArtists.length})` },
            ] as { id: Filter; label: string }[]).map((t) => {
              const active = filter === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setFilter(t.id)}
                  style={{
                    padding: '5px 14px', borderRadius: 999,
                    background: active ? 'var(--accent-live)' : 'var(--bg-elevated)',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid',
                    borderColor: active ? 'var(--accent-live)' : 'var(--border-default)',
                    fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 150ms',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {}
      <div style={{ flex: 1, overflow: 'hidden auto' }}>
        {}
        <style>{SPIN_KEYFRAME}</style>
        {status === 'loading' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <CircleNotch
              size={24}
              color="var(--accent)"
              weight="bold"
              style={{ animation: 'spin 1s linear infinite' }}
            />
          </div>
        )}

        {}
        {status === 'error' && (
          <div style={{ padding: '24px 20px' }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '14px 16px',
              background: 'rgba(255,68,68,0.08)',
              border: '1px solid rgba(255,68,68,0.2)',
              borderRadius: 10,
            }}>
              <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>⚠</span>
              <p style={{ color: 'var(--destructive)', fontSize: 13, fontFamily: 'Syne', lineHeight: 1.5 }}>
                {error ?? 'Search failed. Check your internet connection.'}
              </p>
            </div>
          </div>
        )}

        {}
        {status === 'done' && results.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'Syne' }}>
              No results found for "{query}"
            </p>
          </div>
        )}

        {status === 'done' && results.length > 0 && filter !== 'artists' && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 4,
            }}>
              {visibleResults.map((r) => (
                <SearchResultItem
                  key={r.youtube_id}
                  result={r}
                  onPlay={handlePlay}
                  isPlaying={currentTrack?.youtube_id === r.youtube_id && playbackState === 'playing'}
                  isLoading={currentTrack?.youtube_id === r.youtube_id && playbackState === 'loading'}
                />
              ))}
            </div>
          </div>
        )}

        {}
        {status === 'done' && filter === 'artists' && (
          <div style={{
            padding: '20px 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 18,
          }}>
            {uniqueArtists.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--sans)' }}>
                No artists found in these results.
              </p>
            ) : uniqueArtists.map((a) => (
              <div
                key={a.name}
                onClick={() => useUiStore.getState().setActiveArtist(a.name)}
                style={{
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: 14,
                  borderRadius: 14,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  transition: 'transform 200ms ease, background 200ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = 'var(--bg-surface)';
                }}
              >
                <div style={{
                  width: 96, height: 96, borderRadius: '50%',
                  margin: '0 auto 10px',
                  background: a.firstResult.thumbnail_url
                    ? `center/cover url(${a.firstResult.thumbnail_url})`
                    : 'var(--grad-violet)',
                  boxShadow: '0 8px 18px -8px rgba(0,0,0,0.5)',
                }}/>
                <p style={{
                  fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700,
                  color: 'var(--text-primary)', marginBottom: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{a.name}</p>
                <p style={{
                  fontFamily: 'var(--mono)', fontSize: 10,
                  color: 'var(--text-muted)', letterSpacing: '0.04em',
                }}>
                  {a.count} song{a.count === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        )}

        {}
        {status === 'idle' && (
          <RecentSearches onSelect={handleRecentSelect} />
        )}
      </div>
    </div>
  );
}
