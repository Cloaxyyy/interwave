import { useState, useEffect, useMemo } from 'react';
import {
  House,
  Compass,
  MusicNotes,
  Radio,
  Plus,
  HeartStraight,
  Pause,
  Play,
} from '@phosphor-icons/react';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useFriendsStore } from '../../stores/friendsStore';
import {
  getAllPlaylists, createPlaylist,
  getPlaylist,
} from '../../lib/tauri';
import type { Playlist } from '../../lib/tauri';

const APP_VERSION = '0.7.5';

type NavId = 'home' | 'browse' | 'library' | 'liked';

const NAV_ITEMS: Array<{ id: NavId; label: string; Icon: typeof House }> = [
  { id: 'home',    label: 'Home',          Icon: House },
  { id: 'browse',  label: "What's new",    Icon: Compass },
  { id: 'library', label: 'Your Library',  Icon: MusicNotes },
  { id: 'liked',   label: 'Liked Songs',   Icon: Radio },
];

export default function Sidebar() {
  const { activeView, setActiveView, setActivePlaylist, bumpLibraryVersion, libraryVersion } = useUiStore();
  const displayName = useAuthStore((s) => s.displayName);
  const friends = useFriendsStore((s) => s.friends);
  const friendsActivity = useFriendsStore((s) => s.activity);

  const [pinned, setPinned] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => { getAllPlaylists().then(setPlaylists).catch(() => setPlaylists([])); }, [libraryVersion]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const updates: Record<string, string | null> = {};
      for (const p of playlists) {
        if (thumbs[p.id] !== undefined) continue;
        try {
          const tracks = await getPlaylist(p.id);
          updates[p.id] = tracks.find((t) => t.thumbnail_url)?.thumbnail_url ?? null;
        } catch { updates[p.id] = null; }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setThumbs((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => { cancelled = true; };

  }, [playlists]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { setCreating(false); setNewName(''); return; }
    try {
      const p = await createPlaylist(name);
      setPlaylists((prev) => [...prev, p]);
      bumpLibraryVersion();
    } catch (e) { console.error(e); }
    setCreating(false); setNewName('');
  };

  const onlineFriends = useMemo(() => {
    const out: Array<{ id: string; name: string; track: any }> = [];
    for (const f of friends) {
      const a = friendsActivity.get(f.user_id);
      if (a?.online) out.push({ id: f.user_id, name: f.display_name, track: a.track });
    }
    return out;
  }, [friends, friendsActivity]);

  const navActive: NavId = activeView === 'home'   ? 'home'
                       : activeView === 'browse'  ? 'browse'
                       : activeView === 'liked'   ? 'liked'
                       : (activeView === 'library' || activeView === 'playlist' || activeView === 'artist') ? 'library'
                       : 'home';

  const navigate = (id: NavId) => {
    if (id === 'home') setActiveView('home');
    else if (id === 'browse') setActiveView('browse');
    else if (id === 'library') setActiveView('library');
    else if (id === 'liked') setActiveView('liked');
  };

  void displayName;

  return (
    <aside
      className={`iw-sidebar-host ${pinned ? 'iw-sb-pinned' : ''}`}
      aria-label="Primary navigation"
    >
      <div className="iw-sidebar">
        <nav className="iw-nav-group" aria-label="Sections">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`iw-nav-row ${navActive === id ? 'iw-active' : ''}`}
              onClick={() => navigate(id)}
              data-tip={label} data-tip-bottom=""
              aria-current={navActive === id ? 'page' : undefined}
            >
              <span className="iw-ico"><Icon size={17} /></span>
              <span className="iw-lbl">{label}</span>
              <span className="iw-badge-slot">
                {id === 'library' && playlists.length > 0
                  ? <span className="iw-badge">{playlists.length}</span>
                  : null}
              </span>
            </button>
          ))}
          <button
            className="iw-nav-row"
            onClick={() => setPinned((v) => !v)}
            data-tip={pinned ? 'Collapse sidebar' : 'Pin sidebar open'} data-tip-bottom=""
          >
            <span className="iw-ico">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {pinned
                  ? <><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></>
                  : <><polyline points="9 18 15 12 9 6"/></>}
              </svg>
            </span>
            <span className="iw-lbl">{pinned ? 'Collapse' : 'Pin open'}</span>
            <span className="iw-badge-slot"></span>
          </button>
        </nav>

        <div className="iw-nav-group">
          <div className="iw-nav-label-row">
            <span>Playlists</span>
            <button
              className="iw-ghost-add"
              onClick={() => { setCreating(true); setNewName(''); }}
              data-tip="New playlist" data-tip-bottom=""
              aria-label="New playlist"
            >
              <Plus size={13} weight="bold" />
            </button>
          </div>

          {creating && (
            <div style={{
              display: 'flex', gap: 6, alignItems: 'center',
              padding: '4px 10px', margin: '2px 0',
              background: 'var(--bg-elevated)', borderRadius: 7,
              opacity: 1,
            }}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Playlist name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                }}
                onBlur={handleCreate}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontFamily: 'var(--sans)', fontSize: 12,
                  padding: '5px 0',
                }}
              />
            </div>
          )}

          <button
            className={`iw-pl-row ${activeView === 'liked' ? 'iw-active' : ''}`}
            onClick={() => setActiveView('liked')}
            data-tip="Liked Songs" data-tip-bottom=""
          >
            <span className="iw-pl-art" style={{
              background: 'linear-gradient(135deg, oklch(0.55 0.18 280), oklch(0.45 0.20 230))',
              display: 'grid', placeItems: 'center',
            }}>
              <HeartStraight size={14} weight="fill" color="white" />
            </span>
            <span className="iw-pl-meta">
              <span className="iw-pl-name">Liked Songs</span>
              <span className="iw-pl-sub">Playlist</span>
            </span>
          </button>

          {playlists.length === 0 && !creating ? (
            <div className="iw-sidebar-empty">
              <span>No playlists yet.{' '}
                <button className="iw-link-inline" onClick={() => setCreating(true)}>Create one →</button>
              </span>
            </div>
          ) : playlists.map((p) => {
            const cover = thumbs[p.id];
            const isActive = useUiStore.getState().activePlaylistId === p.id && activeView === 'playlist';
            return (
              <button
                key={p.id}
                className={`iw-pl-row ${isActive ? 'iw-active' : ''}`}
                onClick={() => setActivePlaylist(p.id, p.name)}
                data-tip={p.name} data-tip-bottom=""
              >
                <span className="iw-pl-art">
                  {cover
                    ? <img src={cover} alt="" draggable={false}/>
                    : <span className="iw-pl-glyph">{p.name[0]?.toUpperCase() ?? '♪'}</span>}
                </span>
                <span className="iw-pl-meta">
                  <span className="iw-pl-name">{p.name}</span>
                  <span className="iw-pl-sub">Playlist</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="iw-nav-group">
          <div className="iw-nav-label">Friends Listening</div>
          {onlineFriends.length === 0 ? (
            <div className="iw-sidebar-empty">
              <span>No friends are listening right now.</span>
            </div>
          ) : onlineFriends.map((f) => (
            <button
              key={f.id}
              className="iw-friend"
              onClick={() => setActiveView('friends')}
              data-tip={f.name} data-tip-bottom=""
            >
              <span className={`iw-av ${f.track ? 'iw-online' : 'iw-off'}`}>
                {f.name[0]?.toUpperCase() ?? '?'}
              </span>
              <span className="iw-friend-meta">
                <span className="iw-fname">{f.name}</span>
                <span className={`iw-ftrack ${f.track ? 'iw-live' : ''}`}>
                  {f.track
                    ? <>{f.track.state === 'playing' ? <Play size={8} weight="fill" style={{display:'inline-block', marginRight:3}}/> : <Pause size={8} weight="fill" style={{display:'inline-block', marginRight:3}}/>} {f.track.title}</>
                    : 'Idle'}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--text-muted)',
          letterSpacing: '0.10em', textTransform: 'uppercase',
          padding: '4px 12px', opacity: 0,
          transition: 'opacity 260ms 140ms',
        }}
        className="iw-version-stamp">
          v{APP_VERSION}
        </div>
      </div>
      <style>{`
        .iw-sidebar-host:hover .iw-version-stamp,
        .iw-sidebar-host.iw-sb-pinned .iw-version-stamp { opacity: 1; }
      `}</style>
    </aside>
  );
}

export const __sb_initials = 'unused';
