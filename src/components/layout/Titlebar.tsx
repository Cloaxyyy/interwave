import { useState, useEffect, useRef } from 'react';
import bannerLogo from '../../assets/interwave-banner-dark.svg';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, MagnifyingGlass, House, Bell, Users, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useFriendsStore } from '../../stores/friendsStore';
import { supabase } from '../../lib/supabase';

const appWindow = getCurrentWindow();

interface WinBtnProps {
  icon: React.ReactNode;
  action: () => void;
  label: string;
  danger?: boolean;
}

function WindowButton({ icon, action, label, danger = false }: WinBtnProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={action}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 34, height: 30,
        display: 'grid', placeItems: 'center',
        background: hovered
          ? danger ? 'rgba(255,68,68,0.20)' : 'var(--bg-elevated)'
          : 'transparent',
        border: 'none',
        borderRadius: 6,
        color: danger
          ? hovered ? 'var(--destructive)' : 'var(--text-muted)'
          : hovered ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'background 150ms, color 150ms',
      }}
    >
      {icon}
    </button>
  );
}

function NavArrowButton({ icon, label, onClick, disabled }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 30, height: 30, borderRadius: '50%',
        display: 'grid', placeItems: 'center',
        background: 'rgba(0,0,0,0.45)',
        border: 'none',
        color: disabled ? 'var(--text-muted)' : (hovered ? 'var(--text-primary)' : 'var(--text-secondary)'),
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 140ms',
      }}
    >
      {icon}
    </button>
  );
}

function HomePill({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title="Home"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 44, height: 44, borderRadius: '50%',
        display: 'grid', placeItems: 'center',
        background: active
          ? 'color-mix(in oklch, var(--accent-live) 22%, var(--bg-overlay))'
          : 'var(--bg-overlay)',
        border: 'none',
        color: active ? 'var(--accent)' : (hovered ? 'var(--text-primary)' : 'var(--text-secondary)'),
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'all 140ms',
      }}
    >
      <House size={18} weight={active ? 'fill' : 'regular'} />
    </button>
  );
}

function SearchBar({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        height: 44, padding: '0 16px',
        background: active
          ? 'color-mix(in oklch, var(--accent-live) 12%, var(--bg-overlay))'
          : 'var(--bg-overlay)',
        border: `2px solid ${active ? 'color-mix(in oklch, var(--accent-live) 50%, transparent)' : (hovered ? 'var(--border-strong)' : 'transparent')}`,
        borderRadius: 999,
        color: hovered || active ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontFamily: 'var(--sans)',
        fontSize: 13,
        flex: 1,
        maxWidth: 480,
        minWidth: 280,
        transition: 'all 140ms',
        textAlign: 'left',
      }}
    >
      <MagnifyingGlass size={17} weight="bold" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>What do you want to play?</span>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10,
        padding: '2px 7px', borderRadius: 4,
        background: 'rgba(0,0,0,0.35)',
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}>⌘K</span>
    </button>
  );
}

function RoundIconButton({ icon, label, onClick, active = false }: {
  icon: React.ReactNode; label: string; onClick: () => void; active?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 34, height: 34, borderRadius: '50%',
        display: 'grid', placeItems: 'center',
        background: 'transparent',
        border: 'none',
        color: active ? 'var(--accent)' : (hovered ? 'var(--text-primary)' : 'var(--text-secondary)'),
        cursor: 'pointer',
        transition: 'color 140ms, transform 140ms',
        transform: hovered ? 'scale(1.06)' : 'scale(1)',
      }}
    >
      {icon}
    </button>
  );
}

function ProfileAvatarButton({ initials, onClick, open }: { initials: string; onClick: () => void; open: boolean }) {
  return (
    <button
      onClick={onClick}
      title="Account"
      style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--grad-violet)',
        border: open ? '2px solid var(--accent)' : '2px solid transparent',
        display: 'grid', placeItems: 'center',
        color: '#fff',
        fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 140ms',
      }}
    >
      {initials}
    </button>
  );
}

export default function Titlebar() {
  const activeView = useUiStore((s) => s.activeView);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const { user, displayName, isStaff, signOut } = useAuthStore();
  const onlineFriends = useFriendsStore((s) => {
    const out: number[] = [];
    s.friends.forEach((f) => {
      const a = s.activity.get(f.user_id);
      if (a?.online) out.push(1);
    });
    return out.length;
  });

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const h = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [profileOpen]);

  const initials = (displayName ?? user?.email?.split('@')[0] ?? 'You')[0]?.toUpperCase() ?? '•';

  const triggerSearch = () => {
    setActiveView('search');
  };

  return (
    <div
      data-tauri-drag-region
      style={{
        height: 64,
        background: `
          linear-gradient(180deg,
            color-mix(in oklch, var(--accent-live) 10%, var(--bg-surface)) 0%,
            color-mix(in oklch, var(--accent-live) 4%, var(--bg-surface)) 100%
          )
        `,
        borderBottom: 'none',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 10,
        flexShrink: 0,
        userSelect: 'none',
        transition: 'background 600ms ease',
        position: 'relative',
        zIndex: 5,
      }}
    >
      {}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          flex: 1, minWidth: 0,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          onClick={() => setActiveView('home')}
          style={{ cursor: 'pointer', padding: '0 6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          title="Home"
        >
          <img
            src={bannerLogo}
            alt="Interwave"
            draggable={false}
            style={{ height: 20, display: 'block' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
          <NavArrowButton
            icon={<CaretLeft size={14} weight="bold" />}
            label="Back"
            onClick={() => window.history.back()}
            disabled={false}
          />
          <NavArrowButton
            icon={<CaretRight size={14} weight="bold" />}
            label="Forward"
            onClick={() => window.history.forward()}
            disabled={false}
          />
        </div>
      </div>

      {}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          flex: 2, justifyContent: 'center', minWidth: 0,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <HomePill active={activeView === 'home'} onClick={() => setActiveView('home')} />
        <SearchBar active={activeView === 'search'} onClick={triggerSearch} />
      </div>

      {}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          flex: 1, justifyContent: 'flex-end', minWidth: 0,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <RoundIconButton
          icon={<Bell size={16} weight={activeView === 'browse' ? 'fill' : 'regular'} />}
          label="What's new"
          onClick={() => setActiveView('browse')}
        />
        <div style={{ position: 'relative' }}>
          <RoundIconButton
            icon={<Users size={16} weight={activeView === 'friends' ? 'fill' : 'regular'} />}
            label={`Friends${onlineFriends > 0 ? ` (${onlineFriends} online)` : ''}`}
            onClick={() => setActiveView('friends')}
            active={activeView === 'friends'}
          />
          {onlineFriends > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--success)',
              border: '2px solid var(--bg-surface)',
              pointerEvents: 'none',
            }}/>
          )}
        </div>

        <div ref={profileRef} style={{ position: 'relative', marginLeft: 4 }}>
          <ProfileAvatarButton initials={initials} onClick={() => setProfileOpen((v) => !v)} open={profileOpen} />
          {profileOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              minWidth: 200,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              zIndex: 200,
            }}>
              <ProfileMenuItem label="Profile" onClick={() => { setActiveView('profile'); setProfileOpen(false); }} />
              <ProfileMenuItem label="Settings" onClick={() => { setActiveView('settings'); setProfileOpen(false); }} />
              {isStaff && (
                <ProfileMenuItem label="Admin Panel" onClick={() => { setActiveView('admin'); setProfileOpen(false); }} />
              )}
              <ProfileMenuItem label="Support" onClick={() => { setActiveView('support'); setProfileOpen(false); }} />
              {user && (
                <>
                  <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                  <ProfileMenuItem
                    label="Sign out" destructive
                    onClick={async () => { setProfileOpen(false); await supabase.auth.signOut(); signOut(); }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ width: 8 }} />

        <div style={{ display: 'flex', gap: 2 }}>
          <WindowButton icon={<Minus size={13} weight="bold" />} action={() => appWindow.minimize()} label="Minimize" />
          <WindowButton icon={<Square size={11} weight="bold" />} action={() => appWindow.toggleMaximize()} label="Maximize" />
          <WindowButton icon={<X size={13} weight="bold" />} action={() => appWindow.close()} label="Close" danger />
        </div>
      </div>
    </div>
  );
}

function ProfileMenuItem({ label, onClick, destructive }: { label: string; onClick: () => void; destructive?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', width: '100%',
        padding: '10px 14px', textAlign: 'left',
        background: hovered ? 'var(--bg-overlay)' : 'transparent',
        border: 'none', cursor: 'pointer',
        color: destructive ? 'var(--destructive)' : 'var(--text-primary)',
        fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500,
        transition: 'background 120ms',
      }}
    >
      {label}
    </button>
  );
}
