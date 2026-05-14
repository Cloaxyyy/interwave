import React from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { pause, resume, skipNext, setMiniPlayer } from '../../lib/tauri';
import { useUiStore } from '../../stores/uiStore';

// Tauri drag region is a non-standard CSS property; cast helpers keep TSC happy
const drag: React.CSSProperties = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const noDrag: React.CSSProperties = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

export default function MiniPlayer() {
  const { currentTrack, playbackState } = usePlayerStore();
  const setMiniPlayerStore = useUiStore(s => s.setMiniPlayer);
  const isPlaying = playbackState === 'playing';

  const handleExit = async () => {
    await setMiniPlayer(false);
    setMiniPlayerStore(false);
  };

  return (
    <div style={{
      width: '100%', height: '100vh',
      background: 'var(--bg-elevated)',
      display: 'flex', alignItems: 'center',
      gap: 10, padding: '0 12px',
      borderRadius: 10,
      border: '1px solid var(--border-default)',
      overflow: 'hidden',
      ...drag,
    }}>
      {/* Album art */}
      {currentTrack?.thumbnail_url ? (
        <img
          src={currentTrack.thumbnail_url}
          alt="Album art"
          style={{
            width: 56, height: 56, borderRadius: 6,
            objectFit: 'cover', flexShrink: 0,
            ...noDrag,
          }}
        />
      ) : (
        <div style={{
          width: 56, height: 56, borderRadius: 6,
          background: 'var(--bg-overlay)', flexShrink: 0,
        }} />
      )}

      {/* Track info */}
      <div style={{ flex: 1, minWidth: 0, ...noDrag }}>
        <p style={{
          fontFamily: 'Syne', fontSize: 13, fontWeight: 600,
          color: 'var(--text-primary)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          margin: 0,
        }}>
          {currentTrack?.title ?? 'Nothing playing'}
        </p>
        <p style={{
          fontFamily: 'Syne', fontSize: 11,
          color: 'var(--text-muted)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          margin: 0,
        }}>
          {currentTrack?.artist ?? '—'}
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, ...noDrag }}>
        <MiniBtn onClick={() => isPlaying ? pause() : resume()}>
          {isPlaying ? '⏸' : '▶'}
        </MiniBtn>
        <MiniBtn onClick={() => skipNext().catch(console.error)}>⏭</MiniBtn>
        <MiniBtn onClick={handleExit} title="Exit mini player">↕</MiniBtn>
      </div>
    </div>
  );
}

function MiniBtn({ onClick, children, title }: {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32, borderRadius: 6,
        background: 'transparent', border: 'none',
        color: 'var(--text-secondary)', fontSize: 14,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 100ms, color 100ms',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-overlay)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
      }}
    >
      {children}
    </button>
  );
}
