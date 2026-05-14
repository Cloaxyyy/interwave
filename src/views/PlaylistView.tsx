import { useEffect, useState, useMemo } from 'react';
import { useUiStore } from '../stores/uiStore';
import { usePlayerStore } from '../stores/playerStore';
import { getPlaylist, likeTrack, unlikeTrack, getRecommendations, saveTrackFromSearch, addToQueue } from '../lib/tauri';
import { playWithContext } from '../lib/playContext';
import type { Track, SearchResult } from '../lib/tauri';
import TrackTable from '../components/library/TrackTable';
import PlaylistPickerModal from '../components/library/PlaylistPickerModal';
import HeroHeader from '../components/library/HeroHeader';
import { TrackListSkeleton } from '../components/common/Skeleton';
import { MagnifyingGlass, X as XIcon } from '@phosphor-icons/react';

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

export default function PlaylistView() {
  const { activePlaylistId, activePlaylistName, libraryVersion } = useUiStore();
  const { currentTrack, playbackState } = usePlayerStore();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackToAdd, setTrackToAdd] = useState<Track | null>(null);
  const [isStartingPlay, setIsStartingPlay] = useState(false);
  const [filter, setFilter] = useState('');

  // Reset filter on playlist change
  useEffect(() => { setFilter(''); }, [activePlaylistId]);

  useEffect(() => {
    if (!activePlaylistId) return;
    setLoading(true);
    getPlaylist(activePlaylistId)
      .then(setTracks)
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, [activePlaylistId, libraryVersion]);

  const coverUrl = useMemo(() => {
    return tracks.find((t) => t.thumbnail_url)?.thumbnail_url ?? null;
  }, [tracks]);

  const totalDuration = useMemo(() => formatTotalDuration(tracks), [tracks]);

  const handlePlay = async (track: Track) => {
    if (isStartingPlay) return;
    setIsStartingPlay(true);
    try {
      await playWithContext(track, tracks);
    } catch (err) {
      console.error('[PlaylistView] playTrack failed:', err);
    } finally {
      setIsStartingPlay(false);
    }
  };

  const handlePlayAll = async () => {
    if (tracks.length === 0 || isStartingPlay) return;
    setIsStartingPlay(true);
    try {
      await playWithContext(tracks[0], tracks);
    } catch (err) {
      console.error('[PlaylistView] playAll failed:', err);
    } finally {
      setIsStartingPlay(false);
    }
  };

  const handleShuffle = async () => {
    if (tracks.length === 0 || isStartingPlay) return;
    setIsStartingPlay(true);
    try {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      await playWithContext(shuffled[0], shuffled);
    } catch (err) {
      console.error('[PlaylistView] shuffle failed:', err);
    } finally {
      setIsStartingPlay(false);
    }
  };

  const handleLikeToggle = async (track: Track) => {
    try {
      if (track.liked) {
        await unlikeTrack(track.id);
      } else {
        await likeTrack(track.id);
      }
      setTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, liked: !t.liked } : t))
      );
    } catch (err) {
      console.error('[PlaylistView] like toggle failed:', err);
    }
  };

  if (!activePlaylistId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif', fontSize: 13 }}>
          No playlist selected.
        </p>
      </div>
    );
  }

  // Pick a hue for the hero bloom by hashing the playlist name — gives every
  // playlist a slightly different colour without needing real color extraction.
  const hue = (() => {
    const name = activePlaylistName ?? 'playlist';
    let h = 0; for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i);
    return Math.abs(h % 360);
  })();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <HeroHeader
        eyebrow="Playlist"
        title={activePlaylistName ?? 'Playlist'}
        coverUrl={coverUrl}
        coverFallback={<span style={{ fontSize: 64, color: 'var(--accent-soft)' }}>♪</span>}
        subtitle={loading ? undefined : `${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}${totalDuration ? ` · ${totalDuration}` : ''}`}
        hue={hue}
        loading={loading}
        onPlay={tracks.length > 0 ? handlePlayAll : undefined}
        onShuffle={tracks.length > 0 ? handleShuffle : undefined}
        isStartingPlay={isStartingPlay}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px 24px' }}>
        {loading && <TrackListSkeleton count={8}/>}
        {!loading && tracks.length === 0 && (
          <p style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--text-muted)' }}>
            This playlist is empty. Add tracks from your library.
          </p>
        )}
        {!loading && tracks.length > 0 && (
          <>
            {/* In-playlist search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              margin: '0 12px 12px',
              padding: '8px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              maxWidth: 360,
            }}>
              <MagnifyingGlass size={13} weight="bold" color="var(--text-muted)" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search this playlist…"
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  outline: 'none', color: 'var(--text-primary)',
                  fontFamily: 'var(--sans)', fontSize: 12,
                }}
              />
              {filter && (
                <button
                  onClick={() => setFilter('')}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'grid', placeItems: 'center',
                    padding: 2,
                  }}
                  title="Clear"
                >
                  <XIcon size={12} weight="bold" />
                </button>
              )}
            </div>

            {(() => {
              const q = filter.trim().toLowerCase();
              const filteredTracks = q
                ? tracks.filter(t =>
                    t.title.toLowerCase().includes(q) ||
                    t.artist.toLowerCase().includes(q) ||
                    (t.album?.toLowerCase().includes(q) ?? false)
                  )
                : tracks;
              if (filteredTracks.length === 0) {
                return (
                  <p style={{
                    padding: '36px 24px', textAlign: 'center',
                    fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-muted)',
                  }}>
                    No tracks match "{filter}".
                  </p>
                );
              }
              return (
                <TrackTable
                  tracks={filteredTracks}
                  onPlay={handlePlay}
                  onLikeToggle={handleLikeToggle}
                  onAddToPlaylist={setTrackToAdd}
                  currentTrackId={currentTrack?.id}
                  playbackState={playbackState}
                  showAlbum={true}
                  showDateAdded={false}
                />
              );
            })()}
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
