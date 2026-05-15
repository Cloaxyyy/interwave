
import { CheckCircle, Info, Warning, XCircle, X } from '@phosphor-icons/react';
import { useToastStore, type ToastKind } from '../../stores/toastStore';

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle size={16} weight="fill"/>,
  info:    <Info        size={16} weight="fill"/>,
  warning: <Warning     size={16} weight="fill"/>,
  error:   <XCircle     size={16} weight="fill"/>,
};

const COLORS: Record<ToastKind, { bg: string; border: string; fg: string }> = {
  success: { bg: 'color-mix(in oklch, var(--accent-live) 14%, var(--bg-elevated))',
             border: 'var(--accent-live)', fg: 'var(--accent-live)' },
  info:    { bg: 'color-mix(in oklch, oklch(0.55 0.16 250) 14%, var(--bg-elevated))',
             border: 'oklch(0.65 0.18 250)', fg: 'oklch(0.85 0.10 250)' },
  warning: { bg: 'color-mix(in oklch, oklch(0.55 0.18 50) 14%, var(--bg-elevated))',
             border: 'oklch(0.65 0.18 50)',  fg: 'oklch(0.85 0.10 50)' },
  error:   { bg: 'color-mix(in oklch, oklch(0.55 0.20 25) 14%, var(--bg-elevated))',
             border: 'oklch(0.65 0.20 25)',  fg: 'oklch(0.85 0.12 25)' },
};

export default function ToastStack() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div style={{
      position: 'fixed',
      bottom: 110,
      left: 22,
      zIndex: 8200,
      display: 'flex', flexDirection: 'column-reverse', gap: 8,
      pointerEvents: 'none',
    }}>
      <style>{`
        @keyframes iw-toast-in {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {toasts.map((t) => {
        const c = COLORS[t.kind];
        return (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              minWidth: 240, maxWidth: 360,
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: 12,
              padding: '11px 12px 11px 14px',
              boxShadow: '0 12px 28px -10px rgba(0,0,0,0.55)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
              animation: 'iw-toast-in 220ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div style={{ color: c.fg, marginTop: 1, flexShrink: 0 }}>{ICONS[t.kind]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700,
                color: 'var(--text-primary)', lineHeight: 1.3,
              }}>
                {t.title}
              </p>
              {t.body && (
                <p style={{
                  fontFamily: 'var(--sans)', fontSize: 11,
                  color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4,
                }}>
                  {t.body}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              title="Dismiss"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 2,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              <X size={11} weight="bold"/>
            </button>
          </div>
        );
      })}
    </div>
  );
}
