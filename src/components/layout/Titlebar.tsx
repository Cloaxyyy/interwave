import { useState, useEffect, useRef } from 'react';
import bannerLogo from '../../assets/interwave-banner-dark.svg';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, MagnifyingGlass, Bell, Users, CaretLeft, CaretRight } from '@phosphor-icons/react';
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


function SearchBar({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const focused = active;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        height: 36, padding: '0 16px',
        background: focused ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        border: `1px solid ${focused ? 'var(--accent)' : 'transparent'}`,
        borderRadius: 999,
        color: focused || hovered ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: 'pointer',
        fontFamily: 'var(--sans)',
        fontSize: 13.5,
        flex: 1,
        maxWidth: 440,
        minWidth: 260,
        textAlign: 'left',
        transition: 'border-color 200ms, background 200ms, box-shadow 200ms',
        boxShadow: focused
          ? `0 0 0 4px color-mix(in oklch, var(--accent) 16%, transparent)`
          : 'none',
      }}
    >
      <MagnifyingGlass size={15} weight="bold" style={{ flexShrink: 0, color: focused ? 'var(--accent)' : 'currentColor' }} />
      <span style={{ flex: 1 }}>Search artists, songs, albums…</span>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10.5,
        padding: '2px 6px', borderRadius: 4,
        background: 'var(--bg-base)',
        border: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)',
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}>⌘K</span>
    </button>
  );
}


function ProfileAvatarButton({ initials, onClick, open }: { initials: string; onClick: () => void; open: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title="Account"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
        border: '2px solid var(--bg-base)',
        boxShadow: open || hovered
          ? `0 0 0 1px var(--accent), 0 0 14px color-mix(in oklch, var(--accent) 40%, transparent)`
          : `0 0 0 1px var(--accent)`,
        display: 'grid', placeItems: 'center',
        color: 'var(--accent-ink)',
        fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 200ms var(--ease-spring)',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
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
        height: 56,
        background: 'var(--bg-base)',
        borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px 0 22px',
        gap: 14,
        flexShrink: 0,
        userSelect: 'none',
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
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}
          title="Home"
        >
          <div className="iw-brand-mark" style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
          }}>
            <img src={bannerLogo} alt="" draggable={false} style={{ width: '100%', height: '100%', display: 'block', filter: 'brightness(0) invert(1)' }} />
          </div>
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 17, fontWeight: 600,
            letterSpacing: '-0.015em', color: 'var(--text-primary)',
          }}>
            inter<em style={{ fontStyle: 'normal', color: 'var(--accent)' }}>wave</em>
          </div>
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
        <SearchBar active={activeView === 'search'} onClick={triggerSearch} />
      </div>

      {}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          flex: 1, justifyContent: 'flex-end', minWidth: 0,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}
          title="Help"
          style={{
            height: 32, padding: '0 14px', borderRadius: 999,
            background: 'var(--bg-surface)', border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 12, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer',
            transition: 'background 160ms, color 160ms',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
        >
          <Bell size={13} weight="regular"/>
          <span>Help</span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10,
            padding: '1px 5px', borderRadius: 4,
            background: 'var(--bg-base)',
            border: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)',
            color: 'var(--text-muted)',
          }}>?</span>
        </button>

        <button
          onClick={() => setActiveView('friends')}
          title={`Friends${onlineFriends > 0 ? ` — ${onlineFriends} online` : ''}`}
          style={{
            position: 'relative',
            width: 32, height: 32, borderRadius: 999,
            background: activeView === 'friends' ? 'var(--bg-elevated)' : 'var(--bg-surface)',
            border: 'none',
            color: activeView === 'friends' ? 'var(--accent)' : 'var(--text-secondary)',
            display: 'grid', placeItems: 'center',
            cursor: 'pointer',
            transition: 'background 160ms, color 160ms',
          }}
        >
          <Users size={14} weight={activeView === 'friends' ? 'fill' : 'regular'} />
          {onlineFriends > 0 && (
            <span style={{
              position: 'absolute', top: 5, right: 5,
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--success)',
              border: '2px solid var(--bg-base)',
              pointerEvents: 'none',
            }}/>
          )}
        </button>

        <div ref={profileRef} style={{ position: 'relative' }}>
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
