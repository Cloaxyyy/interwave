
import { useEffect, useState } from 'react';
import { Play } from '@phosphor-icons/react';
import { PageShell, PageHeader } from '../components/layout/PageShell';
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
    <PageShell width="wide">
      <PageHeader
        eyebrow="Browse"
        title="What's playing"
        subtitle="Live queries against YouTube — these update with what's actually trending."
      />
      {SECTIONS.map((s) => (
        <BrowseSection key={s.id} section={s}/>
      ))}
    </PageShell>
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
