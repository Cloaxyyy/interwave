import { useState } from 'react';
import { Play, MusicNote, Heart, Plus, ListPlus } from '@phosphor-icons/react';
import type { Track } from '../../lib/tauri';
import { addToQueue } from '../../lib/tauri';
import { toast } from '../../stores/toastStore';
import { cleanTrackTitle } from '../../lib/cleanTitle';
import TrackContextMenu from '../common/TrackContextMenu';
import PlaylistPickerModal from './PlaylistPickerModal';

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(ts: number | null): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Animated equalizer bars for the currently playing track */
function NowPlayingBars({ paused = false }: { paused?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, width: 12, height: 12 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            flex: 1,
            background: 'var(--accent)',
            borderRadius: 1,
            height: paused ? '40%' : undefined,
            animation: paused ? 'none' : `eqBar${i} 0.${6 + i * 2}s ease-in-out infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes eqBar0 { from { height: 30% } to { height: 100% } }
        @keyframes eqBar1 { from { height: 60% } to { height: 30% } }
        @keyframes eqBar2 { from { height: 20% } to { height: 80% } }
      `}</style>
    </div>
  );
}

function ActionButton({
  children,
  title,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: active ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
        borderRadius: 4,
        transition: 'color 120ms',
      }}
    >
      {children}
    </button>
  );
}

interface TrackTableRowProps {
  track: Track;
  index: number;
  onPlay: (track: Track) => void;
  onLikeToggle: (track: Track) => void;
  onAddToPlaylist: (track: Track) => void;
  isPlaying: boolean;
  isPaused?: boolean;
  showAlbum?: boolean;
  showDateAdded?: boolean;
}

function TrackTableRow({
  track,
  index,
  onPlay,
  onLikeToggle,
  onAddToPlaylist,
  isPlaying,
  isPaused = false,
  showAlbum = true,
  showDateAdded = false,
}: TrackTableRowProps) {
  const [hovered, setHovered] = useState(false);

  const handleQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(track)
      .then(() => toast.success('Added to queue', track.title))
      .catch(() => toast.error('Could not add to queue'));
  };

  return (
    <tr
      data-track-id={track.id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onPlay(track)}
      style={{
        background: isPlaying ? 'var(--accent-glow)' : hovered ? 'var(--bg-elevated)' : 'transparent',
        transition: 'background 120ms',
        cursor: 'default',
      }}
    >
      {/* # / play indicator */}
      <td style={{ width: 40, textAlign: 'right', paddingRight: 16, paddingLeft: 8, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
        {isPlaying && !hovered ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <NowPlayingBars paused={isPaused} />
          </div>
        ) : hovered ? (
          <Play size={13} weight="fill" color="var(--accent)" style={{ display: 'block', marginLeft: 'auto' }} />
        ) : (
          <span style={{ color: isPlaying ? 'var(--accent)' : 'var(--text-muted)' }}>{index + 1}</span>
        )}
      </td>

      {/* Thumbnail + Title + Artist */}
      <td style={{ paddingRight: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 3,
              overflow: 'hidden',
              background: 'var(--bg-overlay)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {track.thumbnail_url ? (
              <img
                src={track.thumbnail_url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                draggable={false}
              />
            ) : (
              <MusicNote size={14} weight="duotone" color="var(--text-muted)" />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                color: isPlaying ? 'var(--accent)' : 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 280,
              }}
            >
              {cleanTrackTitle(track.title)}
            </p>
            <p
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: 11,
                color: 'var(--text-secondary)',
                marginTop: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 280,
              }}
            >
              {track.artist}
            </p>
          </div>
        </div>
      </td>

      {/* Album */}
      {showAlbum && (
        <td style={{ paddingRight: 12 }}>
          <span
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 12,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
              maxWidth: 200,
            }}
          >
            {track.album ?? '—'}
          </span>
        </td>
      )}

      {/* Date Added */}
      {showDateAdded && (
        <td style={{ paddingRight: 12 }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--text-secondary)' }}>
            {formatDate(track.created_at)}
          </span>
        </td>
      )}

      {/* Actions + Duration */}
      <td style={{ width: 140, paddingRight: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
          {hovered ? (
            <>
              <ActionButton title={track.liked ? 'Unlike' : 'Like'} active={track.liked} onClick={() => onLikeToggle(track)}>
                <Heart size={14} weight={track.liked ? 'fill' : 'regular'} />
              </ActionButton>
              <ActionButton title="Add to queue" onClick={handleQueue}>
                <ListPlus size={14} weight="bold" />
              </ActionButton>
              <ActionButton title="Add to playlist" onClick={() => onAddToPlaylist(track)}>
                <Plus size={14} weight="bold" />
              </ActionButton>
            </>
          ) : track.liked ? (
            <Heart size={13} weight="fill" color="var(--accent)" style={{ marginRight: 4, flexShrink: 0 }} />
          ) : null}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)', minWidth: 32, textAlign: 'right', flexShrink: 0 }}>
            {formatDuration(track.duration_seconds)}
          </span>
        </div>
      </td>
    </tr>
  );
}

interface TrackTableProps {
  tracks: Track[];
  onPlay: (track: Track) => void;
  onLikeToggle: (track: Track) => void;
  onAddToPlaylist: (track: Track) => void;
  currentTrackId?: string | null;
  playbackState?: string;
  showAlbum?: boolean;
  showDateAdded?: boolean;
}

interface ContextMenuState {
  track: Track;
  x: number;
  y: number;
}

export default function TrackTable({
  tracks,
  onPlay,
  onLikeToggle,
  onAddToPlaylist,
  currentTrackId,
  playbackState,
  showAlbum = true,
  showDateAdded = false,
}: TrackTableProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [playlistTrack, setPlaylistTrack] = useState<Track | null>(null);

  const handleTableContextMenu = (e: React.MouseEvent<HTMLTableElement>) => {
    e.preventDefault();
    // Walk up from the target to find a <tr> with data-track-id
    let el = e.target as HTMLElement | null;
    while (el && el.tagName !== 'TR') el = el.parentElement;
    if (!el) return;
    const trackId = (el as HTMLTableRowElement).dataset.trackId;
    if (!trackId) return;
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    setContextMenu({ track, x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <table
        style={{ width: '100%', borderCollapse: 'collapse' }}
        onContextMenu={handleTableContextMenu}
      >
        {/* Header */}
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <th style={{ width: 40, textAlign: 'right', paddingRight: 16, paddingLeft: 8, paddingBottom: 8 }}>
              <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>#</span>
            </th>
            <th style={{ textAlign: 'left', paddingBottom: 8, paddingRight: 12 }}>
              <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title</span>
            </th>
            {showAlbum && (
              <th style={{ textAlign: 'left', paddingBottom: 8, paddingRight: 12 }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Album</span>
              </th>
            )}
            {showDateAdded && (
              <th style={{ textAlign: 'left', paddingBottom: 8, paddingRight: 12 }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date Added</span>
              </th>
            )}
            <th style={{ width: 140, textAlign: 'right', paddingBottom: 8, paddingRight: 8 }}>
              <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duration</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((track, i) => (
            <TrackTableRow
              key={track.id}
              track={track}
              index={i}
              onPlay={onPlay}
              onLikeToggle={onLikeToggle}
              onAddToPlaylist={onAddToPlaylist}
              isPlaying={currentTrackId === track.id}
              isPaused={currentTrackId === track.id && playbackState === 'paused'}
              showAlbum={showAlbum}
              showDateAdded={showDateAdded}
            />
          ))}
        </tbody>
      </table>

      {contextMenu && (
        <TrackContextMenu
          track={contextMenu.track}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAddToPlaylist={(t) => {
            setContextMenu(null);
            setPlaylistTrack(t);
          }}
        />
      )}

      {playlistTrack && (
        <PlaylistPickerModal
          track={playlistTrack}
          onClose={() => setPlaylistTrack(null)}
        />
      )}
    </>
  );
}
