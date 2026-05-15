
import { useEffect, useState } from 'react';
import { Megaphone, Warning, Sparkle, X } from '@phosphor-icons/react';
import { subscribeAnnouncements, type AnnouncementRow } from '../../lib/admin';
import { useAuthStore } from '../../stores/authStore';

const DISMISS_KEY = 'iw_dismissed_announcements';

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveDismissed(s: Set<string>) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...s])); } catch {}
}

export default function AnnouncementBanner() {
  const userId = useAuthStore((s) => s.user?.id);
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());

  useEffect(() => {
    if (!userId) { setRows([]); return; }
    const unsub = subscribeAnnouncements(setRows);
    return unsub;
  }, [userId]);

  const visible = rows.filter((r) => !dismissed.has(r.id));
  if (visible.length === 0) return null;

  const a = visible[0];

  const palette: Record<AnnouncementRow['kind'], { bg: string; fg: string; icon: React.ReactNode }> = {
    info:    { bg: 'oklch(0.32 0.14 250)',  fg: '#fff',
               icon: <Megaphone size={14} weight="fill"/> },
    warning: { bg: 'oklch(0.40 0.18 50)',   fg: '#fff',
               icon: <Warning size={14} weight="fill"/> },
    release: { bg: 'var(--grad-violet)',    fg: '#fff',
               icon: <Sparkle size={14} weight="fill"/> },
  };
  const c = palette[a.kind];

  const dismiss = () => {
    const next = new Set(dismissed);
    next.add(a.id);
    setDismissed(next);
    saveDismissed(next);
  };

  return (
    <div style={{
      position: 'fixed', top: 48, left: 240, right: 0,
      zIndex: 10500,
      background: c.bg,
      color: c.fg,
      padding: '8px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600,
      boxShadow: '0 2px 14px -2px rgba(0,0,0,0.4)',
      animation: 'iw-ann-in 280ms cubic-bezier(0.4,0,0.2,1)',
    }}>
      <style>{`
        @keyframes iw-ann-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {c.icon}
      <span style={{ flex: 1 }}>{a.message}</span>
      <button
        onClick={dismiss}
        title="Dismiss"
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.35)',
          borderRadius: 999,
          width: 22, height: 22,
          color: c.fg, cursor: 'pointer',
          display: 'grid', placeItems: 'center',
        }}
      ><X size={11} weight="bold"/></button>
    </div>
  );
}
