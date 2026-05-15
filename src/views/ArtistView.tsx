
import { useEffect, useState, useMemo } from 'react';
import { Play } from '@phosphor-icons/react';
import { useUiStore } from '../stores/uiStore';
import { usePlayerStore } from '../stores/playerStore';
import {
  getLibrary, searchYoutube, playTrack,
  type Track, type SearchResult,
} from '../lib/tauri';
import { playWithContext } from '../lib/playContext';
import HeroHeader from '../components/library/HeroHeader';
import TrackTable from '../components/library/TrackTable';
import { TrackListSkeleton } from '../components/common/Skeleton';
import { cleanTrackTitle } from '../lib/cleanTitle';

export default function ArtistView() {
  const artist = useUiStore((s) => s.activeArtist);
  const { currentTrack, playbackState } = usePlayerStore();
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [topResults, setTopResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [topLoading, setTopLoading] = useState(true);

  useEffect(() => {
    if (!artist) return;
    setLoading(true); setTopLoading(true);
    getLibrary().then(setAllTracks).finally(() => setLoading(false));
    searchYoutube(`${artist} popular songs`)
      .then((r) => setTopResults(r.slice(0, 8)))
      .finally(() => setTopLoading(false));
  }, [artist]);

  const myTracks = useMemo(() => {
    if (!artist) return [];
    const q = artist.toLowerCase();
    return allTracks.filter((t) => t.artist?.toLowerCase().includes(q));
  }, [allTracks, artist]);

  if (!artist) {
    return (
      <div style={{
        flex: 1, display: 'grid', placeItems: 'center',
        color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontSize: 14,
      }}>
        No artist selected.
      </div>
    );
  }

  const playFromTop = (r: SearchResult) => {
    playTrack({
      video_id: r.youtube_id,
      title: r.title,
      artist: r.artist,
      duration_seconds: r.duration_seconds,
      thumbnail_url: r.thumbnail_url,
    }).catch(console.error);
  };

  const playMyAll = () => {
    if (myTracks.length > 0) playWithContext(myTracks[0], myTracks).catch(console.error);
  };
  const shuffleMyAll = () => {
    if (myTracks.length === 0) return;
    const sh = [...myTracks].sort(() => Math.random() - 0.5);
    playWithContext(sh[0], sh).catch(console.error);
  };

  return (
    <div className="iw-page-bg" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <HeroHeader
        eyebrow="Artist"
        title={artist}
        coverUrl={topResults[0]?.thumbnail_url ?? null}
        coverFallback={
          <span style={{ fontSize: 64, color: 'var(--accent-soft)' }}>
            {artist[0]?.toUpperCase() ?? '♪'}
          </span>
        }
        subtitle={loading ? undefined : `${myTracks.length} in your library`}
        onPlay={myTracks.length > 0 ? playMyAll : undefined}
        onShuffle={myTracks.length > 0 ? shuffleMyAll : undefined}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 8px 32px' }}>
        {}
        <SectionHeader title={`In your library (${myTracks.length})`}/>
        {loading ? (
          <TrackListSkeleton count={4}/>
        ) : myTracks.length === 0 ? (
          <p style={{ padding: '0 24px 16px', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--sans)' }}>
            None of {artist}'s songs are in your library yet. Hit the heart on any of their tracks below to add.
          </p>
        ) : (
          <TrackTable
            tracks={myTracks}
            onPlay={(t) => playWithContext(t, myTracks).catch(console.error)}
            onLikeToggle={() => {}}
            onAddToPlaylist={() => {}}
            currentTrackId={currentTrack?.id}
            playbackState={playbackState}
            showAlbum={false}
            showDateAdded={false}
          />
        )}

        {/* Top tracks on YouTube */}
        <div style={{ marginTop: 28 }}>
          <SectionHeader title={`Top on YouTube`} subtitle="What people listen to most for this artist."/>
          {topLoading ? (
            <TrackListSkeleton count={4}/>
          ) : topResults.length === 0 ? (
            <p style={{ padding: '0 24px', color: 'var(--text-muted)', fontSize: 12 }}>
              Couldn't find any tracks. Try the Search tab.
            </p>
          ) : (
            <div style={{
              padding: '0 16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 18,
            }}>
              {topResults.map((r) => (
                <TopCard key={r.youtube_id} r={r} onPlay={playFromTop}/>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ padding: '0 24px 12px' }}>
      <h2 style={{
        fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400,
        letterSpacing: '-0.01em', margin: 0, color: 'var(--text-primary)',
      }}>{title}</h2>
      {subtitle && (
        <p style={{
          fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)',
          marginTop: 3,
        }}>{subtitle}</p>
      )}
    </div>
  );
}

function TopCard({ r, onPlay }: { r: SearchResult; onPlay: (r: SearchResult) => void }) {
  return (
    <div
      onClick={() => onPlay(r)}
      style={{
        cursor: 'pointer', borderRadius: 12, padding: 12,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        transition: 'transform 200ms, background 200ms',
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
        position: 'relative',
        aspectRatio: '1', borderRadius: 8, marginBottom: 10,
        background: r.thumbnail_url
          ? `center/cover url(${r.thumbnail_url})`
          : 'var(--grad-violet)',
        boxShadow: '0 6px 14px -8px rgba(0,0,0,0.5)',
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); onPlay(r); }}
          style={{
            position: 'absolute', right: 8, bottom: 8,
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--accent-live)', border: 'none', cursor: 'pointer',
            color: 'var(--accent-ink)',
            display: 'grid', placeItems: 'center',
            boxShadow: 'var(--shadow-accent)',
          }}
        >
          <Play size={13} weight="fill"/>
        </button>
      </div>
      <p style={{
        fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
        color: 'var(--text-primary)', margin: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {cleanTrackTitle(r.title)}
      </p>
      {r.duration_seconds !== null && (
        <p style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--text-muted)', marginTop: 2,
        }}>
          {Math.floor(r.duration_seconds / 60)}:{String(Math.floor(r.duration_seconds % 60)).padStart(2, '0')}
        </p>
      )}
    </div>
  );
}
