// Reusable empty-state card.

import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export default function EmptyState({
  icon, title, body, actionLabel, onAction, secondaryLabel, onSecondary,
}: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 14, padding: '52px 28px', textAlign: 'center',
      maxWidth: 480, margin: '36px auto',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 16,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'var(--bg-elevated)',
        display: 'grid', placeItems: 'center',
        color: 'var(--accent)',
        boxShadow: '0 4px 20px -8px var(--accent-glow)',
      }}>
        {icon}
      </div>
      <h3 style={{
        fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400,
        letterSpacing: '-0.01em', margin: 0, color: 'var(--text-primary)',
      }}>
        {title}
      </h3>
      <p style={{
        fontFamily: 'var(--sans)', fontSize: 13,
        color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0,
        maxWidth: 360,
      }}>
        {body}
      </p>
      {(actionLabel || secondaryLabel) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {actionLabel && onAction && (
            <button onClick={onAction} className="btn-primary" style={{ padding: '9px 18px', fontSize: 12 }}>
              {actionLabel} →
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button onClick={onSecondary} className="btn-ghost" style={{ padding: '9px 18px', fontSize: 12 }}>
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
