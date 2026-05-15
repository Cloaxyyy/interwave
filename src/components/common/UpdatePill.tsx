
import { useState, useEffect } from 'react';
import { Download, ArrowClockwise, X } from '@phosphor-icons/react';
import { useUpdateStore, applyUpdate, checkForUpdate } from '../../lib/updater';

const APP_VERSION = '0.7.1';

export default function UpdatePill() {
  const status = useUpdateStore((s) => s.status);
  const newVersion = useUpdateStore((s) => s.newVersion);
  const error = useUpdateStore((s) => s.error);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkForUpdate().catch(() => {});
    const id = setInterval(() => checkForUpdate().catch(() => {}), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { setDismissed(false); }, [newVersion]);

  if (status !== 'available' && status !== 'installing') return null;
  if (dismissed && status === 'available') return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 110,
      right: 22,
      zIndex: 8000,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--accent)',
      borderRadius: 14,
      boxShadow: 'var(--shadow-accent), 0 12px 30px -10px rgba(0,0,0,0.6)',
      padding: '12px 14px 12px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      minWidth: 280, maxWidth: 360,
      animation: 'iw-update-pill-in 280ms cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <style>{`
        @keyframes iw-update-pill-in {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes iw-spin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: 'var(--accent-dim)',
        color: 'var(--accent)',
        display: 'grid', placeItems: 'center',
      }}>
        {status === 'installing'
          ? <ArrowClockwise size={16} weight="bold" style={{ animation: 'iw-spin 1s linear infinite' }}/>
          : <Download size={16} weight="bold"/>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700,
          color: 'var(--text-primary)', lineHeight: 1.2,
        }}>
          {status === 'installing'
            ? 'Installing update…'
            : `Update available — v${newVersion}`}
        </p>
        <p style={{
          fontFamily: 'var(--sans)', fontSize: 11,
          color: 'var(--text-secondary)', lineHeight: 1.3, marginTop: 2,
        }}>
          {status === 'installing'
            ? 'Interwave will restart in a moment.'
            : `You're on v${APP_VERSION}. Restart to install.`}
        </p>
      </div>
      {status === 'available' && (
        <>
          <button
            onClick={() => applyUpdate()}
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              border: 'none', borderRadius: 8,
              fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700,
              padding: '6px 12px', cursor: 'pointer',
              flexShrink: 0,
            }}
          >Restart</button>
          <button
            onClick={() => setDismissed(true)}
            title="Dismiss (we'll remind you next launch)"
            style={{
              width: 22, height: 22,
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              flexShrink: 0,
            }}
          ><X size={12} weight="bold"/></button>
        </>
      )}
      {error && (
        <p style={{ fontSize: 10, color: 'var(--destructive)' }}>{error}</p>
      )}
    </div>
  );
}
