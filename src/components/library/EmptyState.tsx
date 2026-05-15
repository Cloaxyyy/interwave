import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  compact?: boolean;
}

export default function EmptyState({
  title, body, actionLabel, onAction, secondaryLabel, onSecondary, compact,
}: Props) {
  return (
    <div className={`iw-empty ${compact ? 'iw-empty-compact' : ''}`}>
      <WaveMark />
      <h3 className="iw-empty-title">{title}</h3>
      <p className="iw-empty-body">{body}</p>
      {(actionLabel || secondaryLabel) && (
        <div className="iw-empty-action">
          {actionLabel && onAction && (
            <button onClick={onAction} className="iw-btn-pill iw-btn-primary">
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button onClick={onSecondary} className="iw-btn-pill iw-btn-ghost-pill">
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function WaveMark() {
  return (
    <div className="iw-empty-mark" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="iw-empty-wave">
        <defs>
          <linearGradient id="iw-ew-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="var(--accent-deep)"/>
            <stop offset="100%" stopColor="var(--accent)"/>
          </linearGradient>
        </defs>
        <path d="M 12 50 Q 24 22, 36 50 T 60 50 T 84 50 T 100 50"
          fill="none" stroke="url(#iw-ew-grad)" strokeWidth="2.2"
          strokeLinecap="round" className="iw-empty-wave-a"/>
        <path d="M 12 50 Q 24 78, 36 50 T 60 50 T 84 50 T 100 50"
          fill="none" stroke="url(#iw-ew-grad)" strokeWidth="2.2"
          strokeLinecap="round" className="iw-empty-wave-b"/>
      </svg>
    </div>
  );
}
