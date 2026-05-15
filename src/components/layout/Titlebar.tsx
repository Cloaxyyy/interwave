import { useState, useEffect, useRef } from 'react';
import bannerLogo from '../../assets/interwave-banner-dark.svg';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Minus, Square, X, MagnifyingGlass, CaretLeft, CaretRight, Question,
  MicrophoneStage, MusicNotes, House, Users,
} from '@phosphor-icons/react';
import { useUiStore, type View } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useFriendsStore } from '../../stores/friendsStore';
import { supabase } from '../../lib/supabase';

const appWindow = getCurrentWindow();

interface TabSpec {
  id: View;
  kicker: string;
  name: string;
  Icon: typeof MicrophoneStage;
}

export default function Titlebar() {
  const activeView = useUiStore((s) => s.activeView);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const activePlaylistName = useUiStore((s) => s.activePlaylistName);
  const activeArtist = useUiStore((s) => s.activeArtist);
  const { user, displayName, isStaff, signOut } = useAuthStore();
  const onlineFriendCount = useFriendsStore((s) => {
    let n = 0;
    s.friends.forEach((f) => { if (s.activity.get(f.user_id)?.online) n++; });
    return n;
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

  const tabs: TabSpec[] = [];
  if (activeView === 'home')     tabs.push({ id: 'home',     kicker: 'HOME',     name: 'Welcome',                          Icon: House });
  if (activeView === 'browse')   tabs.push({ id: 'browse',   kicker: 'NEW',      name: 'Release notes',                    Icon: MusicNotes });
  if (activeView === 'library')  tabs.push({ id: 'library',  kicker: 'LIBRARY',  name: 'Your Library',                     Icon: MusicNotes });
  if (activeView === 'liked')    tabs.push({ id: 'liked',    kicker: 'LIKED',    name: 'Liked Songs',                      Icon: MusicNotes });
  if (activeView === 'queue')    tabs.push({ id: 'queue',    kicker: 'QUEUE',    name: 'Up next',                          Icon: MusicNotes });
  if (activeView === 'search')   tabs.push({ id: 'search',   kicker: 'SEARCH',   name: 'Search',                           Icon: MagnifyingGlass });
  if (activeView === 'friends')  tabs.push({ id: 'friends',  kicker: 'FRIENDS',  name: 'Friend activity',                  Icon: Users });
  if (activeView === 'playlist' && activePlaylistName) {
    tabs.push({ id: 'playlist', kicker: 'PLAYLIST', name: activePlaylistName, Icon: MusicNotes });
  }
  if (activeView === 'artist' && activeArtist) {
    tabs.push({ id: 'artist', kicker: 'ARTIST', name: activeArtist, Icon: MicrophoneStage });
  }
  if (activeView === 'profile')  tabs.push({ id: 'profile',  kicker: 'YOU',      name: 'Profile',                          Icon: Users });
  if (activeView === 'settings') tabs.push({ id: 'settings', kicker: 'SETTINGS', name: 'Preferences',                      Icon: MusicNotes });
  if (activeView === 'admin')    tabs.push({ id: 'admin',    kicker: 'ADMIN',    name: 'Control panel',                    Icon: MusicNotes });
  if (activeView === 'support')  tabs.push({ id: 'support',  kicker: 'HELP',     name: 'Support',                          Icon: Question });
  if (activeView === 'import')   tabs.push({ id: 'import',   kicker: 'IMPORT',   name: 'Import',                           Icon: MusicNotes });

  const triggerSearch = () => setActiveView('search');
  const showHelp = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));

  return (
    <header className="iw-topbar" data-tauri-drag-region>
      {/* Brand */}
      <div
        onClick={() => setActiveView('home')}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}
        title="Home"
      >
        <span className="iw-brand-mark" style={{
          background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
        }}>
          <img src={bannerLogo} alt="" draggable={false} style={{ width: '100%', height: '100%', display: 'block', filter: 'brightness(0) invert(1)' }} />
        </span>
        <div style={{
          fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em',
          color: 'var(--text-primary)', fontFamily: 'var(--sans)',
        }}>
          inter<em style={{ fontStyle: 'normal', color: 'var(--accent)' }}>wave</em>
        </div>
      </div>

      {/* Nav arrows */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onMouseDown={(e) => e.stopPropagation()}>
        <button className="iw-arrow-btn" title="Back" onClick={() => window.history.back()}>
          <CaretLeft size={14} weight="bold" />
        </button>
        <button className="iw-arrow-btn" title="Forward" onClick={() => window.history.forward()}>
          <CaretRight size={14} weight="bold" />
        </button>
      </div>

      {/* Search */}
      <div
        className={`iw-search ${activeView === 'search' ? 'iw-active' : ''}`}
        onClick={triggerSearch}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <MagnifyingGlass size={15} weight="bold" color={activeView === 'search' ? 'var(--accent)' : 'var(--text-muted)'} />
        <span className="iw-search-input" style={{ pointerEvents: 'none', color: 'var(--text-muted)' }}>
          Search artists, songs, albums…
        </span>
        <span className="iw-kbd">⌘K</span>
      </div>

      {/* Open tabs */}
      <div className="iw-tabs" onMouseDown={(e) => e.stopPropagation()}>
        {tabs.map((t) => (
          <div key={t.id} className={`iw-tab iw-tab-active`} onClick={() => setActiveView(t.id)}>
            <div className="iw-tab-icon"><t.Icon size={14} /></div>
            <div style={{ minWidth: 0 }}>
              <div className="iw-tab-kicker">{t.kicker}</div>
              <div className="iw-tab-name">{t.name}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }} onMouseDown={(e) => e.stopPropagation()}>
        <button className="iw-help-btn" onClick={showHelp} title="Keyboard shortcuts">
          <Question size={13} />
          <span>Help</span>
          <span className="iw-kbd">?</span>
        </button>

        <button
          onClick={() => setActiveView('friends')}
          title={`Friends${onlineFriendCount > 0 ? ` — ${onlineFriendCount} online` : ''}`}
          style={{
            position: 'relative',
            width: 32, height: 32, borderRadius: '50%',
            background: activeView === 'friends' ? 'var(--bg-elevated)' : 'var(--bg-surface)',
            border: 'none',
            color: activeView === 'friends' ? 'var(--accent)' : 'var(--text-secondary)',
            display: 'grid', placeItems: 'center',
            cursor: 'pointer',
            transition: 'background 160ms, color 160ms',
          }}
        >
          <Users size={14} weight={activeView === 'friends' ? 'fill' : 'regular'} />
          {onlineFriendCount > 0 && (
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
          <button
            className="iw-user-avatar"
            title="Account"
            onClick={() => setProfileOpen((v) => !v)}
          >
            {initials}
          </button>
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
              <ProfileMenuItem label="Profile"  onClick={() => { setActiveView('profile'); setProfileOpen(false); }} />
              <ProfileMenuItem label="Queue"    onClick={() => { setActiveView('queue'); setProfileOpen(false); }} />
              <ProfileMenuItem label="Settings" onClick={() => { setActiveView('settings'); setProfileOpen(false); }} />
              {isStaff && (
                <ProfileMenuItem label="Admin Panel" onClick={() => { setActiveView('admin'); setProfileOpen(false); }} />
              )}
              <ProfileMenuItem label="Support" onClick={() => { setActiveView('support'); setProfileOpen(false); }} />
              {user && (
                <>
                  <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                  <ProfileMenuItem label="Sign out" destructive onClick={async () => { setProfileOpen(false); await supabase.auth.signOut(); signOut(); }} />
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
          <WindowButton icon={<Minus size={13} weight="bold" />} action={() => appWindow.minimize()} label="Minimize" />
          <WindowButton icon={<Square size={11} weight="bold" />} action={() => appWindow.toggleMaximize()} label="Maximize" />
          <WindowButton icon={<X size={13} weight="bold" />} action={() => appWindow.close()} label="Close" danger />
        </div>
      </div>
    </header>
  );
}

function WindowButton({ icon, action, label, danger = false }: {
  icon: React.ReactNode; action: () => void; label: string; danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={action}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 32, height: 28,
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
