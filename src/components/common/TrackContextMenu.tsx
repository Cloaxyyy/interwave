import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { playTrack, addToQueue, likeTrack, unlikeTrack } from '../../lib/tauri';
import type { Track } from '../../lib/tauri';

interface TrackContextMenuProps {
  track: Track;
  x: number;
  y: number;
  onClose: () => void;
  onAddToPlaylist: (track: Track) => void;
}

const MENU_WIDTH = 180;
const ITEM_HEIGHT = 32;

export default function TrackContextMenu({
  track,
  x,
  y,
  onClose,
  onAddToPlaylist,
}: TrackContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Clamp so menu doesn't overflow viewport
  const clampedX = x + MENU_WIDTH > window.innerWidth ? x - MENU_WIDTH : x;
  // Approximate total menu height: 7 items + 2 dividers = ~7*32 + 2*9 = 242px
  const estimatedH = 7 * ITEM_HEIGHT + 2 * 9;
  const clampedY = y + estimatedH > window.innerHeight ? y - estimatedH : y;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = () => onClose();

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  const handlePlayNow = () => {
    playTrack({
      video_id: track.youtube_id,
      title: track.title,
      artist: track.artist,
      duration_seconds: track.duration_seconds,
      thumbnail_url: track.thumbnail_url,
    }).catch(console.error);
    onClose();
  };

  const handleAddToQueue = () => {
    addToQueue(track).catch(console.error);
    onClose();
  };

  const handleLikeToggle = () => {
    if (track.liked) {
      unlikeTrack(track.id).catch(console.error);
    } else {
      likeTrack(track.id).catch(console.error);
    }
    onClose();
  };

  const handleAddToPlaylist = () => {
    onAddToPlaylist(track);
    onClose();
  };

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(`https://youtube.com/watch?v=${track.youtube_id}`)
      .catch(console.error);
    onClose();
  };

  const menu = (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: clampedX,
        top: clampedY,
        width: MENU_WIDTH,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        zIndex: 9999,
        overflow: 'hidden',
        padding: '4px 0',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuItem onClick={handlePlayNow}>Play now</MenuItem>
      <MenuItem onClick={handleAddToQueue}>Add to queue</MenuItem>

      <Divider />

      <MenuItem onClick={handleLikeToggle}>
        {track.liked ? 'Unlike' : 'Like'}
      </MenuItem>
      <MenuItem onClick={handleAddToPlaylist}>Add to playlist…</MenuItem>

      <Divider />

      <MenuItem onClick={handleCopyLink}>Copy YouTube link</MenuItem>
    </div>
  );

  return ReactDOM.createPortal(menu, document.body);
}

function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        height: ITEM_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        fontFamily: 'Syne, sans-serif',
        fontSize: 12,
        color: 'var(--text-primary)',
        cursor: 'pointer',
        transition: 'background 80ms',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-overlay)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: 'var(--border-subtle)',
        margin: '4px 0',
      }}
    />
  );
}
