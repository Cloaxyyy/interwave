
import { Wrench } from '@phosphor-icons/react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { useMaintenanceFor } from '../../stores/maintenanceStore';

interface Props {
  children: React.ReactNode;
}

const PAGE_LABEL: Record<string, string> = {
  home: 'Home', search: 'Search', library: 'Library', queue: 'Queue',
  liked: 'Liked Songs', playlist: 'Playlists', import: 'Import', profile: 'Profile',
  settings: 'Settings', admin: 'Admin',
};

export default function MaintenanceWall({ children }: Props) {
  const view = useUiStore((s) => s.activeView);
  const isStaff = useAuthStore((s) => s.isStaff);
  const m = useMaintenanceFor(view);

  if (view === 'admin') return <>{children}</>;

  if (m && isStaff) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <div style={{
          flexShrink: 0,
          padding: '8px 16px',
          background: 'color-mix(in oklch, var(--accent) 14%, var(--bg-surface))',
          borderBottom: '1px solid color-mix(in oklch, var(--accent) 30%, var(--border-subtle))',
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'var(--sans)', fontSize: 11,
          color: 'var(--text-secondary)',
        }}>
          <Wrench size={12} weight="fill" color="var(--accent)"/>
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>{PAGE_LABEL[view] ?? view}</strong>
            {' '}is under maintenance for users — staff bypass
          </span>
          <em style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
            "{m.message}"
          </em>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {children}
        </div>
      </div>
    );
  }

  if (!m) return <>{children}</>;

  return (
    <div style={{
      flex: 1,
      display: 'grid', placeItems: 'center',
      padding: 32,
      background: `radial-gradient(ellipse at top, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%), var(--bg-base)`,
    }}>
      <div style={{
        maxWidth: 480, textAlign: 'center',
        padding: 36,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 18,
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: 16,
          background: 'var(--grad-violet)',
          display: 'grid', placeItems: 'center',
          margin: '0 auto 18px',
          boxShadow: 'var(--shadow-accent)',
        }}>
          <Wrench size={26} weight="fill" color="white"/>
        </div>
        <p style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--text-muted)', letterSpacing: '0.10em',
          textTransform: 'uppercase', marginBottom: 8,
        }}>
          Page maintenance
        </p>
        <h2 style={{
          fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400,
          letterSpacing: '-0.02em', margin: '0 0 12px',
        }}>
          {PAGE_LABEL[view] ?? view} is unavailable
        </h2>
        <p style={{
          fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--text-secondary)',
          lineHeight: 1.55, margin: 0,
        }}>
          {m.message}
        </p>
      </div>
    </div>
  );
}
