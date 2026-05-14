import React from 'react';
import { usePlayerStore } from '../../stores/playerStore';

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface ProgressBarProps {
  variant?: 'full' | 'compact';
  onSeek?: (positionSecs: number) => void;
}

export default function ProgressBar({ variant = 'full', onSeek }: ProgressBarProps) {
  const { position, duration, waveform } = usePlayerStore();
  const [dragging, setDragging] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  // Local drag fraction (0–1) for visual feedback; seek fires only on mouseup.
  const [dragFraction, setDragFraction] = React.useState<number | null>(null);
  const barRef = React.useRef<HTMLDivElement>(null);

  const fractionAt = (clientX: number): number => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!onSeek || duration === 0) return;
    e.preventDefault();
    setDragging(true);
    setDragFraction(fractionAt(e.clientX));
  };

  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      // Visual feedback only — no seek command on every pixel.
      setDragFraction(fractionAt(e.clientX));
    };
    const onUp = (e: MouseEvent) => {
      const frac = fractionAt(e.clientX);
      setDragFraction(null);
      setDragging(false);
      if (onSeek && duration > 0) {
        onSeek(frac * duration);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, duration, onSeek]);

  const progress = dragFraction !== null
    ? dragFraction * 100
    : (duration > 0 ? (position / duration) * 100 : 0);

  const active = hovered || dragging;
  const hasWaveform = waveform.length > 0;
  const height = hasWaveform ? 24 : (variant === 'compact' ? 2 : (active ? 5 : 3));

  return (
    <div style={{ width: '100%' }}>
      <div
        ref={barRef}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          height,
          background: hasWaveform ? 'transparent' : 'var(--border-default)',
          borderRadius: 2,
          cursor: onSeek && duration > 0 ? 'pointer' : 'default',
          transition: 'height 120ms ease',
          overflow: 'hidden',
        }}
      >
        {/* Waveform visualization */}
        {hasWaveform && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'flex-end',
            gap: '1px', padding: '0 0',
            pointerEvents: 'none',
            overflow: 'hidden',
          }}>
            {waveform.map((amplitude, i) => {
              const pct = i / waveform.length;
              const played = dragFraction !== null ? dragFraction : (duration > 0 ? position / duration : 0);
              const isPast = pct < played;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${Math.max(15, amplitude * 100)}%`,
                    background: isPast ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
                    borderRadius: '1px 1px 0 0',
                    transition: 'height 300ms ease',
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Progress fill (shown only when no waveform) */}
        {!hasWaveform && (
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'var(--accent)',
              borderRadius: 2,
              transition: dragging ? 'none' : 'width 200ms linear',
            }}
          />
        )}

        {/* Handle dot */}
        {active && onSeek && duration > 0 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: `${progress}%`,
            transform: 'translate(-50%, -50%)',
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 0 3px rgba(200,255,87,0.2)',
            pointerEvents: 'none',
            zIndex: 2,
          }} />
        )}
      </div>
      {variant === 'full' && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 6,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: 'var(--text-muted)',
          }}
        >
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      )}
    </div>
  );
}
