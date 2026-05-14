import { useEffect, useState, useMemo } from 'react';
import { MusicNotes } from '@phosphor-icons/react';
import { usePlayerStore } from '../stores/playerStore';
import { useUiStore } from '../stores/uiStore';
import { getLibrary, likeTrack, unlikeTrack } from '../lib/tauri';
import { playWithContext } from '../lib/playContext';
import type { Track } from '../lib/tauri';
import TrackTable from '../components/library/TrackTable';
import PlaylistPickerModal from '../components/library/PlaylistPickerModal';
import HeroHeader from '../components/library/HeroHeader';
import EmptyState from '../components/library/EmptyState';
import { TrackListSkeleton } from '../components/common/Skeleton';

export default function LibraryView() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackToAdd, setTrackToAdd] = useState<Track | null>(null);
  const { currentTrack, playbackState } = usePlayerStore();
  const { bumpLibraryVersion, libraryVersion, setActiveView } = useUiStore();

  useEffect(() => {
    getLibrary()
      .then(setTracks)
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, [libraryVersion]);

  const handlePlay = async (track: Track) => {
    try {
      await playWithContext(track, tracks);
    } catch (err) {
      console.error('[LibraryView] playTrack failed:', err);
    }
  };

  const handlePlayAll = async () => {
    if (tracks.length === 0) return;
    try {
      await playWithContext(tracks[0], tracks);
    } catch (err) {
      console.error('[LibraryView] playAll failed:', err);
    }
  };

  const handleShuffle = async () => {
    if (tracks.length === 0) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    try {
      await playWithContext(shuffled[0], shuffled);
    } catch (err) {
      console.error('[LibraryView] shuffle failed:', err);
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
      bumpLibraryVersion();
    } catch (err) {
      console.error('[LibraryView] like toggle failed:', err);
    }
  };

  const coverUrl = useMemo(() =>
    tracks.find(t => t.thumbnail_url)?.thumbnail_url ?? null,
    [tracks]
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <HeroHeader
        eyebrow="Your Music"
        title="Library"
        coverUrl={coverUrl}
        coverFallback={
          <MusicNotes size={88} weight="duotone" color="var(--accent-soft)" />
        }
        subtitle={loading ? undefined : `${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}`}
        loading={loading}
        onPlay={tracks.length > 0 ? handlePlayAll : undefined}
        onShuffle={tracks.length > 0 ? handleShuffle : undefined}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px 24px' }}>
        {loading && <TrackListSkeleton count={10}/>}
        {!loading && tracks.length === 0 && (
          <EmptyState
            icon={<MusicNotes size={28} weight="duotone"/>}
            title="Your library is empty"
            body="Anything you play, like, or import shows up here. Start by searching for a song or importing a Spotify playlist."
            actionLabel="Open search"
            onAction={() => setActiveView('search')}
            secondaryLabel="Import from Spotify"
            onSecondary={() => setActiveView('import')}
          />
        )}
        {!loading && tracks.length > 0 && (
          <TrackTable
            tracks={tracks}
            onPlay={handlePlay}
            onLikeToggle={handleLikeToggle}
            onAddToPlaylist={setTrackToAdd}
            currentTrackId={currentTrack?.id}
            playbackState={playbackState}
            showAlbum={true}
            showDateAdded={true}
          />
        )}
      </div>

      {/* Playlist picker modal */}
      {trackToAdd && (
        <PlaylistPickerModal track={trackToAdd} onClose={() => setTrackToAdd(null)} />
      )}
    </div>
  );
}
