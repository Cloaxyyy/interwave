import { useEffect, useState, useMemo } from 'react';
import { MusicNotes, MagnifyingGlass, Heart, Rows, SquaresFour, Play } from '@phosphor-icons/react';
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

type ViewMode = 'songs' | 'albums';

interface AlbumGroup {
  key: string;
  album: string;
  artist: string;
  cover: string | null;
  tracks: Track[];
}

function groupByAlbum(tracks: Track[]): AlbumGroup[] {
  const map = new Map<string, AlbumGroup>();
  for (const t of tracks) {
    const albumName = t.album?.trim() || 'Singles';
    const key = `${t.artist.toLowerCase()}::${albumName.toLowerCase()}`;
    const existing = map.get(key);
    if (existing) {
      existing.tracks.push(t);
      if (!existing.cover && t.thumbnail_url) existing.cover = t.thumbnail_url;
    } else {
      map.set(key, {
        key,
        album: albumName,
        artist: t.artist,
        cover: t.thumbnail_url,
        tracks: [t],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const aa = a.artist.localeCompare(b.artist);
    return aa !== 0 ? aa : a.album.localeCompare(b.album);
  });
}

export default function LibraryView() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackToAdd, setTrackToAdd] = useState<Track | null>(null);
  const [query, setQuery] = useState('');
  const [likedOnly, setLikedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('songs');
  const [expandedAlbum, setExpandedAlbum] = useState<string | null>(null);
  const { currentTrack, playbackState } = usePlayerStore();
  const { bumpLibraryVersion, libraryVersion, setActiveView } = useUiStore();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracks.filter((t) => {
      if (likedOnly && !t.liked) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [tracks, query, likedOnly]);

  const albums = useMemo(() => groupByAlbum(filtered), [filtered]);

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
    <div className="iw-page-bg" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
        {!loading && tracks.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0 12px 14px', flexWrap: 'wrap',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              flex: '1 1 240px', maxWidth: 320,
              padding: '7px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
            }}>
              <MagnifyingGlass size={14} weight="bold" color="var(--text-muted)" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter title, artist, album…"
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontFamily: 'var(--sans)', fontSize: 12.5,
                }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 0, fontSize: 14, lineHeight: 1,
                  }}
                >×</button>
              )}
            </div>
            <button
              onClick={() => setLikedOnly((v) => !v)}
              title={likedOnly ? 'Showing liked only' : 'Show liked only'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 999,
                background: likedOnly ? 'rgba(200,255,87,0.10)' : 'transparent',
                border: `1px solid ${likedOnly ? 'var(--accent)' : 'var(--border-default)'}`,
                color: likedOnly ? 'var(--accent)' : 'var(--text-secondary)',
                fontFamily: 'var(--sans)', fontSize: 12,
                cursor: 'pointer', transition: 'all 120ms',
              }}
            >
              <Heart size={13} weight={likedOnly ? 'fill' : 'regular'} />
              Liked
            </button>
            <div style={{ flex: 1 }}/>
            <div style={{
              display: 'flex',
              padding: 3,
              background: 'var(--bg-elevated)',
              borderRadius: 8,
              border: '1px solid var(--border-default)',
              gap: 2,
            }}>
              {([
                { id: 'songs',  label: 'Songs',  Icon: Rows },
                { id: 'albums', label: 'Albums', Icon: SquaresFour },
              ] as const).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setViewMode(id)}
                  title={label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 6, border: 'none',
                    background: viewMode === id ? 'var(--bg-overlay)' : 'transparent',
                    color: viewMode === id ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: viewMode === id ? 600 : 400,
                    cursor: 'pointer', transition: 'all 120ms',
                  }}
                >
                  <Icon size={13} weight={viewMode === id ? 'fill' : 'regular'} />
                  {label}
                </button>
              ))}
            </div>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)',
              minWidth: 80, textAlign: 'right',
            }}>
              {viewMode === 'songs'
                ? `${filtered.length} ${filtered.length === 1 ? 'song' : 'songs'}`
                : `${albums.length} ${albums.length === 1 ? 'album' : 'albums'}`}
            </span>
          </div>
        )}

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
        {!loading && tracks.length > 0 && filtered.length === 0 && (
          <p style={{
            textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
            fontFamily: 'var(--sans)', padding: '40px 20px',
          }}>
            No matches for "{query}"{likedOnly ? ' in liked tracks' : ''}.
          </p>
        )}
        {!loading && filtered.length > 0 && viewMode === 'songs' && (
          <TrackTable
            tracks={filtered}
            onPlay={handlePlay}
            onLikeToggle={handleLikeToggle}
            onAddToPlaylist={setTrackToAdd}
            currentTrackId={currentTrack?.id}
            playbackState={playbackState}
            showAlbum={true}
            showDateAdded={true}
          />
        )}
        {!loading && filtered.length > 0 && viewMode === 'albums' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            gap: 18, padding: '0 12px',
          }}>
            {albums.map((a) => {
              const isExpanded = expandedAlbum === a.key;
              return (
                <div
                  key={a.key}
                  style={{
                    gridColumn: isExpanded ? '1 / -1' : 'auto',
                    background: isExpanded ? 'var(--bg-surface)' : 'transparent',
                    border: isExpanded ? '1px solid var(--border-default)' : 'none',
                    borderRadius: isExpanded ? 12 : 0,
                    padding: isExpanded ? 16 : 0,
                  }}
                >
                  <div
                    onClick={() => setExpandedAlbum((cur) => (cur === a.key ? null : a.key))}
                    className="card-hover"
                    style={{
                      display: isExpanded ? 'flex' : 'block',
                      gap: 16,
                      cursor: 'pointer',
                      alignItems: isExpanded ? 'flex-start' : undefined,
                    }}
                  >
                    <div style={{
                      width: isExpanded ? 140 : '100%',
                      aspectRatio: '1',
                      background: a.cover
                        ? `center/cover url(${a.cover})`
                        : 'linear-gradient(135deg, var(--bg-elevated), var(--bg-overlay))',
                      borderRadius: 8,
                      flexShrink: 0,
                      position: 'relative',
                      marginBottom: isExpanded ? 0 : 10,
                    }}>
                      {a.tracks[0] && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playWithContext(a.tracks[0], a.tracks).catch(console.error);
                          }}
                          aria-label="Play album"
                          style={{
                            position: 'absolute',
                            bottom: 8, right: 8,
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'var(--accent)',
                            border: 'none',
                            color: '#000',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                          }}
                        >
                          <Play size={14} weight="fill" />
                        </button>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
                        color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{a.album}</div>
                      <div style={{
                        fontFamily: 'var(--sans)', fontSize: 11.5,
                        color: 'var(--text-secondary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginTop: 2,
                      }}>{a.artist}</div>
                      <div style={{
                        fontFamily: 'var(--mono)', fontSize: 10,
                        color: 'var(--text-muted)',
                        marginTop: 4, letterSpacing: '0.04em',
                      }}>
                        {a.tracks.length} {a.tracks.length === 1 ? 'TRACK' : 'TRACKS'}
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ marginTop: 14, marginLeft: 156 }}>
                      <TrackTable
                        tracks={a.tracks}
                        onPlay={(t) => playWithContext(t, a.tracks).catch(console.error)}
                        onLikeToggle={handleLikeToggle}
                        onAddToPlaylist={setTrackToAdd}
                        currentTrackId={currentTrack?.id}
                        playbackState={playbackState}
                        showAlbum={false}
                        showDateAdded={false}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {}
      {trackToAdd && (
        <PlaylistPickerModal track={trackToAdd} onClose={() => setTrackToAdd(null)} />
      )}
    </div>
  );
}
