
import { Play, Shuffle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

interface HeroHeaderProps {

  eyebrow: string;
  title: string;

  coverUrl?: string | null;

  coverFallback?: ReactNode;

  subtitle?: string;

  meta?: string;

  hue?: number;

  onPlay?: () => void;
  onShuffle?: () => void;
  loading?: boolean;
  isStartingPlay?: boolean;
}

export default function HeroHeader({
  eyebrow, title, coverUrl, coverFallback, subtitle, meta,
  onPlay, onShuffle, loading = false, isStartingPlay = false,
}: HeroHeaderProps) {

  const bg = `
    radial-gradient(ellipse 80% 100% at 25% 0%,
      color-mix(in oklch, var(--accent-live) 30%, transparent) 0%,
      transparent 65%),
    linear-gradient(180deg, var(--tint-12) 0%, var(--bg-base) 100%)
  `;

  return (
    <div
      style={{
        flexShrink: 0,
        padding: '40px 32px 28px',
        background: bg,
        borderBottom: '1px solid var(--border-subtle)',
        position: 'relative',
      }}
    >
      {}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 6px)',
      }}/>

      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 28,
        position: 'relative',
      }}>
        {}
        <div
          style={{
            width: 200, height: 200, borderRadius: 10, flexShrink: 0,
            background: coverUrl ? `center/cover url(${coverUrl})` : 'var(--bg-overlay)',
            overflow: 'hidden',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 24px 48px -16px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)',
          }}
        >
          {!coverUrl && coverFallback}
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingBottom: 6 }}>
          <p style={{
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
            color: 'rgba(255,255,255,0.7)',
            textTransform: 'uppercase', letterSpacing: '0.10em',
            marginBottom: 12,
          }}>
            {eyebrow}
          </p>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(40px, 6vw, 72px)',
              fontWeight: 400,
              color: 'var(--text-primary)',
              lineHeight: 0.95,
              letterSpacing: '-0.02em',
              marginBottom: 16,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h1>
          {!loading && subtitle && (
            <p style={{
              fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-secondary)',
              marginBottom: meta ? 4 : 0,
            }}>
              {subtitle}
            </p>
          )}
          {!loading && meta && (
            <p style={{
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)',
              letterSpacing: '0.04em',
            }}>
              {meta}
            </p>
          )}
        </div>
      </div>

      {}
      {!loading && onPlay && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22, position: 'relative' }}>
          <button
            onClick={onPlay}
            disabled={isStartingPlay}
            className="btn-primary"
            style={{
              padding: '12px 24px',
              fontSize: 14,
              opacity: isStartingPlay ? 0.7 : 1,
              cursor: isStartingPlay ? 'wait' : 'pointer',
            }}
          >
            <Play size={16} weight="fill" />
            {isStartingPlay ? 'Loading…' : 'Play'}
          </button>
          {onShuffle && (
            <button
              onClick={onShuffle}
              disabled={isStartingPlay}
              className="btn-ghost"
            >
              <Shuffle size={14} weight="bold" />
              Shuffle
            </button>
          )}
        </div>
      )}
    </div>
  );
}
