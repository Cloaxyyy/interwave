import { useEffect, useRef, useState } from 'react';
import { Moon, MusicNote } from '@phosphor-icons/react';
import { pause } from '../../lib/tauri';
import { usePlayerStore } from '../../stores/playerStore';

type TimerOption = 'off' | 15 | 30 | 45 | 60 | 'end-of-song';

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SleepTimer() {
  const [open, setOpen] = useState(false);

  const [timerMode, setTimerMode] = useState<TimerOption>('off');
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const endOfSongFiredRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const playbackState = usePlayerStore((s) => s.playbackState);

  useEffect(() => {
    if (timerMode === 'off' || timerMode === 'end-of-song' || endsAt === null) return;

    const tick = () => {
      const diff = (endsAt - Date.now()) / 1000;
      if (diff <= 0) {
        setRemaining(0);
        pause().catch(console.error);
        setTimerMode('off');
        setEndsAt(null);
      } else {
        setRemaining(diff);
      }
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timerMode, endsAt]);

  useEffect(() => {
    if (timerMode !== 'end-of-song') {
      endOfSongFiredRef.current = false;
      return;
    }
    if (playbackState === 'ended' && !endOfSongFiredRef.current) {
      endOfSongFiredRef.current = true;
      pause().catch(console.error);
      setTimerMode('off');
    }
  }, [timerMode, playbackState]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectOption = (option: TimerOption) => {
    setOpen(false);
    if (option === 'off') {
      setTimerMode('off');
      setEndsAt(null);
      setRemaining(null);
    } else if (option === 'end-of-song') {
      endOfSongFiredRef.current = false;
      setTimerMode('end-of-song');
      setEndsAt(null);
      setRemaining(null);
    } else {
      const ms = option * 60 * 1000;
      setTimerMode(option);
      setEndsAt(Date.now() + ms);
      setRemaining(option * 60);
    }
  };

  const isActive = timerMode !== 'off';

  const options: { label: string; value: TimerOption }[] = [
    { label: 'Off', value: 'off' },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '45 min', value: 45 },
    { label: '60 min', value: 60 },
    { label: 'End of song', value: 'end-of-song' },
  ];

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={isActive ? `Sleep timer active${remaining !== null ? ` — ${formatRemaining(remaining)}` : ''}` : 'Sleep timer'}
        style={{
          background: 'transparent',
          border: '1px solid transparent',
          borderRadius: 6,
          color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: 'pointer',
          fontFamily: 'var(--mono)',
          fontSize: 10,
          fontWeight: 500,
          padding: '5px 8px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          whiteSpace: 'nowrap',
          transition: 'color 150ms',
        }}
        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
      >
        <Moon size={14} weight={isActive ? 'fill' : 'regular'} />
        {isActive && timerMode === 'end-of-song' && <MusicNote size={10} weight="fill" />}
        {isActive && remaining !== null && (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatRemaining(remaining)}</span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            right: 0,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            overflow: 'hidden',
            minWidth: 140,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 100,
          }}
        >
          <div style={{
            padding: '6px 10px 4px',
            fontSize: 10,
            fontFamily: 'Syne, sans-serif',
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border-default)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            Sleep timer
          </div>
          {options.map((opt) => {
            const isCurrent = timerMode === opt.value;
            return (
              <button
                key={String(opt.value)}
                onClick={() => selectOption(opt.value)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: isCurrent ? 'var(--bg-overlay)' : 'none',
                  border: 'none',
                  color: isCurrent ? 'var(--accent)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontFamily: 'Syne, sans-serif',
                  fontSize: 12,
                  fontWeight: isCurrent ? 600 : 400,
                  padding: '8px 14px',
                  transition: 'background 100ms',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-overlay)';
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = 'none';
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
