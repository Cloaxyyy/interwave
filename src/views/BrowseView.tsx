// Browse — trending YouTube queries laid out as card grids.

import { useEffect, useState } from 'react';
import { Play } from '@phosphor-icons/react';
import { searchYoutube, playTrack, type SearchResult } from '../lib/tauri';
import { TrackListSkeleton } from '../components/common/Skeleton';
import { cleanTrackTitle } from '../lib/cleanTitle';

interface Section {
  id: string;
  title: string;
  query: string;
}

const SECTIONS: Section[] = [
  { id: 'trending',    title: 'Trending now',          query: 'trending songs this week' },
  { id: 'pop',         title: 'Pop hits',              query: 'pop hits 2025' },
  { id: 'hiphop',      title: 'Hip-hop & rap',         query: 'top hip hop songs 2025' },
  { id: 'rnb',         title: 'R&B',                   query: 'best rnb songs 2025' },
  { id: 'rock',        title: 'Rock',                  query: 'rock hits 2025' },
  { id: 'electronic',  title: 'Electronic',            query: 'edm electronic 2025' },
  { id: 'indie',       title: 'Indie & alternative',   query: 'indie alternative 2025' },
  { id: 'chill',       title: 'Chill & lofi',          query: 'lofi chill beats 2025' },
];

export default function BrowseView() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        padding: '24px 28px 18px',
        borderBottom: '1px solid var(--seam)',
        background: 'linear-gradient(180deg, var(--tint-12) 0%, transparent 100%)',
      }}>
        <p style={{
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)',
          letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8,
        }}>
          Browse
        </p>
        <h1 style={{
          fontFamily: 'var(--serif)', fontSize: 'clamp(36px, 5vw, 56px)',
          fontWeight: 400, letterSpacing: '-0.02em', margin: 0,
          color: 'var(--text-primary)', lineHeight: 1,
        }}>
          What's playing
        </h1>
        <p style={{
          fontFamily: 'var(--sans)', fontSize: 13,
          color: 'var(--text-secondary)', marginTop: 8,
        }}>
          Live queries against YouTube — these update with what's actually trending.
        </p>
      </div>

      {/* Sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 56px' }}>
        {SECTIONS.map((s) => (
          <BrowseSection key={s.id} section={s}/>
        ))}
      </div>
    </div>
  );
}

function BrowseSection({ section }: { section: Section }) {
  const [items, setItems] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    searchYoutube(section.query)
      .then((r) => setItems(r.slice(0, 6)))
      .finally(() => setLoading(false));
  }, [section.query]);

  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{
        fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400,
        letterSpacing: '-0.01em', margin: '0 0 14px', color: 'var(--text-primary)',
      }}>
        {section.title}
      </h2>
      {loading ? (
        <TrackListSkeleton count={3}/>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
          gap: 16,
        }}>
          {items.map((r) => (
            <BrowseCard key={r.youtube_id} r={r}/>
          ))}
        </div>
      )}
    </section>
  );
}

function BrowseCard({ r }: { r: SearchResult }) {
  const play = () => playTrack({
    video_id: r.youtube_id,
    title: r.title, artist: r.artist,
    duration_seconds: r.duration_seconds,
    thumbnail_url: r.thumbnail_url,
  }).catch(console.error);

  return (
    <div
      onClick={play}
      style={{
        cursor: 'pointer', borderRadius: 12, padding: 12,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        transition: 'transform 200ms, background 200ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.background = 'var(--bg-elevated)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.background = 'var(--bg-surface)';
      }}
    >
      <div style={{
        position: 'relative',
        aspectRatio: '1', borderRadius: 8, marginBottom: 10,
        background: r.thumbnail_url
          ? `center/cover url(${r.thumbnail_url})`
          : 'var(--grad-violet)',
        boxShadow: '0 6px 14px -8px rgba(0,0,0,0.5)',
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); play(); }}
          style={{
            position: 'absolute', right: 8, bottom: 8,
            width: 38, height: 38, borderRadius: '50%',
            background: 'var(--accent-live)', border: 'none', cursor: 'pointer',
            color: 'var(--accent-ink)',
            display: 'grid', placeItems: 'center',
            boxShadow: 'var(--shadow-accent)',
          }}
        >
          <Play size={14} weight="fill"/>
        </button>
      </div>
      <p style={{
        fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
        color: 'var(--text-primary)', margin: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{cleanTrackTitle(r.title)}</p>
      <p style={{
        fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)',
        marginTop: 2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{r.artist}</p>
    </div>
  );
}
