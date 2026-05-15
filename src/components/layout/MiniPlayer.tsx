import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { pause, resume, skipNext, setMiniPlayer } from '../../lib/tauri';
import { useUiStore } from '../../stores/uiStore';
import { extractAccentColor } from '../../lib/colorExtract';

const drag: React.CSSProperties = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const noDrag: React.CSSProperties = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

export default function MiniPlayer() {
  const { currentTrack, playbackState } = usePlayerStore();
  const setMiniPlayerStore = useUiStore(s => s.setMiniPlayer);
  const isPlaying = playbackState === 'playing';

  const [accent, setAccent] = useState<string>('oklch(0.72 0.18 295)');

  useEffect(() => {
    let cancelled = false;
    extractAccentColor(currentTrack?.thumbnail_url)
      .then((c) => { if (!cancelled) setAccent(c); });
    return () => { cancelled = true; };
  }, [currentTrack?.thumbnail_url]);

  const handleExit = async () => {
    await setMiniPlayer(false);
    setMiniPlayerStore(false);
  };

  return (
    <div style={{
      width: '100%', height: '100vh',
      background: `
        radial-gradient(ellipse at 0% 50%,
          color-mix(in oklch, ${accent} 30%, transparent) 0%,
          transparent 60%
        ),
        radial-gradient(ellipse at 100% 50%,
          color-mix(in oklch, ${accent} 14%, transparent) 0%,
          transparent 60%
        ),
        linear-gradient(180deg,
          color-mix(in oklch, ${accent} 8%, var(--bg-elevated)) 0%,
          var(--bg-base) 100%
        )
      `,
      display: 'flex', alignItems: 'center',
      gap: 10, padding: '0 12px',
      borderRadius: 10,
      border: `1px solid color-mix(in oklch, ${accent} 25%, var(--border-default))`,
      overflow: 'hidden',
      transition: 'background 600ms ease, border-color 600ms ease',
      ...drag,
    }}>
      {}
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

      {}
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

      {}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, ...noDrag }}>
        <MiniBtn accent={accent} primary onClick={() => isPlaying ? pause() : resume()}>
          {isPlaying ? '⏸' : '▶'}
        </MiniBtn>
        <MiniBtn accent={accent} onClick={() => skipNext().catch(console.error)}>⏭</MiniBtn>
        <MiniBtn accent={accent} onClick={handleExit} title="Exit mini player">↕</MiniBtn>
      </div>
    </div>
  );
}

function MiniBtn({ onClick, children, title, accent, primary }: {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  accent: string;
  primary?: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);
  const bg = primary
    ? `color-mix(in oklch, ${accent} ${hovered ? 32 : 22}%, var(--bg-elevated))`
    : (hovered ? `color-mix(in oklch, ${accent} 18%, transparent)` : 'transparent');
  const color = primary || hovered
    ? 'var(--text-primary)'
    : 'var(--text-secondary)';
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 32, height: 32, borderRadius: 6,
        background: bg, border: 'none',
        color, fontSize: 14,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 160ms, color 160ms',
      }}
    >
      {children}
    </button>
  );
}
