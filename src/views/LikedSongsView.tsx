import { useEffect, useState, useMemo } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { useUiStore } from '../stores/uiStore';
import { getLikedTracks, likeTrack, unlikeTrack, getRecommendations, saveTrackFromSearch, addToQueue } from '../lib/tauri';
import { playWithContext } from '../lib/playContext';
import type { Track, SearchResult } from '../lib/tauri';
import TrackTable from '../components/library/TrackTable';
import PlaylistPickerModal from '../components/library/PlaylistPickerModal';
import HeroHeader from '../components/library/HeroHeader';
import EmptyState from '../components/library/EmptyState';
import { TrackListSkeleton } from '../components/common/Skeleton';
import { HeartStraight } from '@phosphor-icons/react';

function RecommendedSection({ seedYoutubeId }: { seedYoutubeId: string }) {
  const [recs, setRecs] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!seedYoutubeId) return;
    setLoading(true);
    getRecommendations(seedYoutubeId)
      .then(setRecs)
      .catch(() => setRecs([]))
      .finally(() => setLoading(false));
  }, [seedYoutubeId]);

  if (loading) return (
    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'Syne, sans-serif' }}>
      Loading recommendations…
    </div>
  );
  if (recs.length === 0) return null;

  return (
    <div style={{ padding: '24px 24px 12px' }}>
      <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>
        Recommended
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recs.map((r) => (
          <div key={r.youtube_id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px',
            borderRadius: 6, cursor: 'pointer', transition: 'background 150ms',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-overlay)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {r.thumbnail_url ? (
              <img src={r.thumbnail_url} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} draggable={false} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--bg-overlay)', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
              <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.artist}</p>
            </div>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const track = await saveTrackFromSearch(r.youtube_id, r.title, r.artist, r.duration_seconds, r.thumbnail_url);
                  await addToQueue(track);
                } catch (err) { console.error('add to queue failed:', err); }
              }}
              style={{
                background: 'transparent', border: '1px solid var(--border-default)',
                borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer',
                padding: '3px 8px', fontSize: 11, fontFamily: 'Syne, sans-serif',
                transition: 'all 150ms', flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            >
              + Queue
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTotalDuration(tracks: Track[]): string {
  const total = tracks.reduce((sum, t) => sum + (t.duration_seconds ?? 0), 0);
  if (total === 0) return '';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  return `${m} min`;
}

export default function LikedSongsView() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackToAdd, setTrackToAdd] = useState<Track | null>(null);
  const { currentTrack, playbackState } = usePlayerStore();
  const libraryVersion = useUiStore((s) => s.libraryVersion);
  const setActiveView = useUiStore((s) => s.setActiveView);

  useEffect(() => {
    getLikedTracks()
      .then(setTracks)
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, [libraryVersion]);

  const totalDuration = useMemo(() => formatTotalDuration(tracks), [tracks]);

  const handlePlay = async (track: Track) => {
    try {
      await playWithContext(track, tracks);
    } catch (err) {
      console.error('[LikedSongsView] playTrack failed:', err);
    }
  };

  const handlePlayAll = async () => {
    if (tracks.length === 0) return;
    try {
      await playWithContext(tracks[0], tracks);
    } catch (err) {
      console.error('[LikedSongsView] playAll failed:', err);
    }
  };

  const handleShuffle = async () => {
    if (tracks.length === 0) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    try {
      await playWithContext(shuffled[0], shuffled);
    } catch (err) {
      console.error('[LikedSongsView] shuffle failed:', err);
    }
  };

  const handleLikeToggle = async (track: Track) => {
    // Unliking removes it from this view; liking (shouldn't happen here but handle gracefully)
    try {
      if (track.liked) {
        await unlikeTrack(track.id);
        setTracks((prev) => prev.filter((t) => t.id !== track.id));
      } else {
        await likeTrack(track.id);
        setTracks((prev) =>
          prev.map((t) => (t.id === track.id ? { ...t, liked: true } : t))
        );
      }
    } catch (err) {
      console.error('[LikedSongsView] like toggle failed:', err);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <HeroHeader
        eyebrow="Your Library"
        title="Liked Songs"
        coverUrl={null}
        coverFallback={
          <div style={{
            width: '100%', height: '100%',
            background: 'var(--grad-twilight)',
            display: 'grid', placeItems: 'center',
          }}>
            <HeartStraight size={88} weight="fill" color="white" />
          </div>
        }
        subtitle={loading ? undefined : `${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}${totalDuration ? ` · ${totalDuration}` : ''}`}
        loading={loading}
        onPlay={tracks.length > 0 ? handlePlayAll : undefined}
        onShuffle={tracks.length > 0 ? handleShuffle : undefined}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px 24px' }}>
        {loading && <TrackListSkeleton count={8}/>}
        {!loading && tracks.length === 0 && (
          <EmptyState
            icon={<HeartStraight size={28} weight="duotone"/>}
            title="No liked songs yet"
            body="Hit the heart on any track and it lives here forever — no algorithm, no expiration."
            actionLabel="Open library"
            onAction={() => setActiveView('library')}
            secondaryLabel="Search"
            onSecondary={() => setActiveView('search')}
          />
        )}
        {!loading && tracks.length > 0 && (
          <>
            <TrackTable
              tracks={tracks}
              onPlay={handlePlay}
              onLikeToggle={handleLikeToggle}
              onAddToPlaylist={setTrackToAdd}
              currentTrackId={currentTrack?.id}
              playbackState={playbackState}
              showAlbum={false}
              showDateAdded={false}
            />
            <RecommendedSection seedYoutubeId={tracks[0]?.youtube_id ?? ''} />
          </>
        )}
      </div>

      {trackToAdd && (
        <PlaylistPickerModal track={trackToAdd} onClose={() => setTrackToAdd(null)} />
      )}
    </div>
  );
}
