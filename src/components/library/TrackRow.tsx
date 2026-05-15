import { useState } from 'react';
import { Play, MusicNote, Heart, Plus, ListPlus } from '@phosphor-icons/react';
import type { Track } from '../../lib/tauri';
import { addToQueue } from '../../lib/tauri';
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

function NowPlayingBars({ paused = false }: { paused?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, width: 14, height: 14 }}>
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

interface TrackRowProps {
  track: Track;
  onPlay: (track: Track) => void;
  onLikeToggle: (track: Track) => void;
  onAddToPlaylist: (track: Track) => void;
  isPlaying: boolean;
  isPaused?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
}

export default function TrackRow({
  track,
  onPlay,
  onLikeToggle,
  onAddToPlaylist,
  isPlaying,
  isPaused = false,
}: TrackRowProps) {
  const [hovered, setHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);

  const handleQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(track).catch(console.error);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={handleContextMenu}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 16px',
        borderRadius: 6,
        background: isPlaying ? 'var(--accent-glow)' : hovered ? 'var(--bg-elevated)' : 'transparent',
        transition: 'background 120ms',
        cursor: 'default',
      }}
    >
      {}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 4,
          overflow: 'hidden',
          background: 'var(--bg-overlay)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
          cursor: 'pointer',
        }}
        onClick={() => onPlay(track)}
      >
        {track.thumbnail_url ? (
          <img
            src={track.thumbnail_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            draggable={false}
          />
        ) : (
          <MusicNote size={16} weight="duotone" color="var(--text-muted)" />
        )}

        {}
        {isPlaying && !hovered && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <NowPlayingBars paused={isPaused} />
          </div>
        )}

        {}
        {hovered && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={16} weight="fill" color="var(--accent)" />
          </div>
        )}
      </div>

      {}
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onPlay(track)}>
        <p
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            color: isPlaying ? 'var(--accent)' : 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
          onClick={() => onPlay(track)}
        >
          {track.title}
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
          }}
        >
          {track.artist}
        </p>
      </div>

      {}
      {!hovered && track.duration_seconds !== null && (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
          {formatDuration(track.duration_seconds)}
        </span>
      )}

      {}
      {hovered && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <ActionButton title={track.liked ? 'Unlike' : 'Like'} active={track.liked} onClick={() => onLikeToggle(track)}>
            <Heart size={15} weight={track.liked ? 'fill' : 'regular'} />
          </ActionButton>
          <ActionButton title="Add to queue" onClick={handleQueue}>
            <ListPlus size={15} weight="bold" />
          </ActionButton>
          <ActionButton title="Add to playlist" onClick={() => onAddToPlaylist(track)}>
            <Plus size={15} weight="bold" />
          </ActionButton>
        </div>
      )}
    </div>

      {contextMenu && (
        <TrackContextMenu
          track={track}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAddToPlaylist={() => {
            setContextMenu(null);
            setShowPlaylistPicker(true);
          }}
        />
      )}

      {showPlaylistPicker && (
        <PlaylistPickerModal
          track={track}
          onClose={() => setShowPlaylistPicker(false)}
        />
      )}
    </>
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
        padding: 5,
        borderRadius: 4,
        transition: 'color 120ms',
      }}
    >
      {children}
    </button>
  );
}
