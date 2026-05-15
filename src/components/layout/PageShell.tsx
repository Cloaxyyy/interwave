import type { ReactNode, CSSProperties } from 'react';

interface PageShellProps {
  children: ReactNode;

  width?: 'normal' | 'wide' | 'narrow';

  noPadding?: boolean;

  noScroll?: boolean;

  contentStyle?: CSSProperties;
}

const WIDTHS = {
  narrow: 720,
  normal: 1080,
  wide: 1320,
};

export function PageShell({
  children,
  width = 'normal',
  noPadding = false,
  noScroll = false,
  contentStyle,
}: PageShellProps) {
  return (
    <div
      className="iw-page-bg"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: noScroll ? 'hidden' : 'auto',
        overflowX: 'hidden',
        minHeight: 0,
        position: 'relative',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: WIDTHS[width],
          margin: '0 auto',
          padding: noPadding ? 0 : '24px 32px 56px',
          flex: noScroll ? 1 : 'unset',
          display: noScroll ? 'flex' : 'block',
          flexDirection: 'column',
          minHeight: noScroll ? 0 : undefined,
          position: 'relative',
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 28,
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        {eyebrow && (
          <p
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--text-muted)',
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            {eyebrow}
          </p>
        )}
        <h1
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 'clamp(34px, 4.5vw, 48px)',
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 6,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
    </div>
  );
}
