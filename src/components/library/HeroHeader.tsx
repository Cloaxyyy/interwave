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
  extra?: ReactNode;
  loading?: boolean;
  isStartingPlay?: boolean;
}

export default function HeroHeader({
  eyebrow, title, coverUrl, coverFallback, subtitle, meta,
  onPlay, onShuffle, extra, loading = false, isStartingPlay = false,
}: HeroHeaderProps) {
  return (
    <div className="iw-pl-hero">
      <div
        className="iw-cover-art"
        style={{
          background: coverUrl
            ? `center/cover url(${coverUrl})`
            : 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
          display: 'grid', placeItems: 'center',
        }}
      >
        {!coverUrl && coverFallback}
      </div>

      <div className="iw-pl-info">
        <div className="iw-pl-kicker">
          <b>{eyebrow}</b>
          {subtitle && (
            <>
              <span style={{ color: 'var(--text-disabled)' }}>·</span>
              <span style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--sans)', color: 'var(--text-secondary)' }}>
                {subtitle}
              </span>
            </>
          )}
        </div>

        <h1 className="iw-pl-title">
          {renderTitleWithAccent(title)}
        </h1>

        {meta && (
          <div className="iw-pl-meta-row">
            <span>{meta}</span>
          </div>
        )}

        {!loading && (onPlay || extra) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
            {onPlay && (
              <button
                onClick={onPlay}
                disabled={isStartingPlay}
                className="iw-btn-pill iw-btn-primary"
                style={{
                  opacity: isStartingPlay ? 0.7 : 1,
                  cursor: isStartingPlay ? 'wait' : 'pointer',
                }}
              >
                <Play size={16} weight="fill" />
                {isStartingPlay ? 'Loading…' : 'Play'}
              </button>
            )}
            {onShuffle && (
              <button
                onClick={onShuffle}
                disabled={isStartingPlay}
                className="iw-btn-pill iw-btn-ghost-pill"
              >
                <Shuffle size={14} weight="bold" />
                Shuffle
              </button>
            )}
            {extra}
          </div>
        )}
      </div>
    </div>
  );
}

/* Splits the last word of the title into an italic-serif accent —
 * "Liked Songs" → "Liked <em>Songs</em>", matching the design's
 * pl-title pattern where every hero name has a flourish on the tail. */
function renderTitleWithAccent(title: string): React.ReactNode {
  const trimmed = title.trim();
  if (!trimmed) return trimmed;
  const idx = trimmed.lastIndexOf(' ');
  if (idx <= 0 || idx >= trimmed.length - 1) {
    return <em>{trimmed}</em>;
  }
  return (
    <>
      {trimmed.slice(0, idx)} <em>{trimmed.slice(idx + 1)}</em>
    </>
  );
}
