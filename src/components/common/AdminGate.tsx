// Full-screen overlay shown when the user is suspended or global
// maintenance is on. Staff bypass the block and see a top banner instead.

import { useEffect, useState } from 'react';
import { ShieldWarning, Wrench } from '@phosphor-icons/react';
import { useAuthStore } from '../../stores/authStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useUiStore } from '../../stores/uiStore';
import { useMaintenanceStore, useGlobalMaintenance, useSuspension } from '../../stores/maintenanceStore';
import { subscribeAdminState } from '../../lib/admin';
import { pause } from '../../lib/tauri';

export default function AdminGate() {
  const userId = useAuthStore((s) => s.user?.id);
  const isStaff = useAuthStore((s) => s.isStaff);
  const playbackState = usePlayerStore((s) => s.playbackState);
  const setMaintenance = useMaintenanceStore((s) => s.setMaintenance);
  const setSuspension = useMaintenanceStore((s) => s.setSuspension);
  const setActiveView = useUiStore((s) => s.setActiveView);

  const globalMaintenance = useGlobalMaintenance();
  const suspension = useSuspension();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Subscribe ONCE per logged-in user — pump everything into the shared store
  useEffect(() => {
    if (!userId) {
      setMaintenance([]);
      setSuspension(null);
      return;
    }
    const unsub = subscribeAdminState(userId, ({ maintenance, suspension }) => {
      setMaintenance(maintenance);
      setSuspension(suspension);
    });
    return unsub;
  }, [userId, setMaintenance, setSuspension]);

  const blocked = !isStaff && (!!suspension || !!globalMaintenance);

  // Force-pause when blocked
  useEffect(() => {
    if (blocked && playbackState === 'playing') pause().catch(() => {});
  }, [blocked, playbackState]);

  // Reset dismissal when state changes (so banner reappears if maint was off then on)
  useEffect(() => { setBannerDismissed(false); }, [globalMaintenance?.page, globalMaintenance?.enabled]);

  if (isStaff && globalMaintenance && !bannerDismissed) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        zIndex: 11000,
        background: 'linear-gradient(90deg, color-mix(in oklch, var(--accent) 40%, oklch(0.30 0.18 295)), oklch(0.30 0.18 295))',
        color: 'white',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px',
        fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600,
        boxShadow: '0 2px 12px -2px rgba(0,0,0,0.5)',
      }}>
        <Wrench size={14} weight="fill"/>
        <span>
          Maintenance is ON for users — you can still use the app as staff.
          Message: <em style={{ opacity: 0.85 }}>"{globalMaintenance.message}"</em>
        </span>
        <button
          onClick={() => setActiveView('admin')}
          style={{
            marginLeft: 'auto',
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: 999,
            color: 'white', cursor: 'pointer',
            padding: '4px 12px',
            fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600,
          }}
        >
          Open Admin →
        </button>
        <button
          onClick={() => setBannerDismissed(true)}
          title="Hide for this session"
          style={{
            background: 'transparent', border: 'none',
            color: 'white', cursor: 'pointer',
            fontSize: 16, lineHeight: 1, padding: '0 4px',
            opacity: 0.7,
          }}
        >×</button>
      </div>
    );
  }

  if (!blocked) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 12000,
      background: 'rgba(8, 5, 16, 0.96)',
      backdropFilter: 'blur(40px) saturate(140%)',
      WebkitBackdropFilter: 'blur(40px) saturate(140%)',
      display: 'grid', placeItems: 'center',
      padding: 24,
    }}>
      <div style={{
        maxWidth: 520,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 18,
        padding: 36,
        textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 18,
          background: suspension ? 'oklch(0.45 0.20 25)' : 'var(--grad-violet)',
          display: 'grid', placeItems: 'center',
          margin: '0 auto 20px',
          boxShadow: suspension
            ? '0 12px 28px -8px oklch(0.45 0.20 25 / 0.6)'
            : 'var(--shadow-accent)',
        }}>
          {suspension
            ? <ShieldWarning size={32} weight="fill" color="white"/>
            : <Wrench size={32} weight="fill" color="white"/>}
        </div>
        <h1 style={{
          fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400,
          letterSpacing: '-0.02em', margin: '0 0 8px', color: 'var(--text-primary)',
        }}>
          {suspension ? 'Account suspended' : 'Down for maintenance'}
        </h1>
        <p style={{
          fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--text-secondary)',
          lineHeight: 1.55, margin: '0 0 20px',
        }}>
          {suspension?.reason ?? globalMaintenance?.message ?? 'Interwave is temporarily unavailable.'}
        </p>
        {suspension?.expires_at && (
          <p style={{
            fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)',
            margin: '0 0 20px', letterSpacing: '0.04em',
          }}>
            Lifts on {new Date(suspension.expires_at).toLocaleString()}
          </p>
        )}
        <p style={{
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)',
          letterSpacing: '0.10em', textTransform: 'uppercase', marginTop: 4,
        }}>
          {suspension ? 'Contact a moderator to appeal' : 'We\'ll be back shortly'}
        </p>
      </div>
    </div>
  );
}
