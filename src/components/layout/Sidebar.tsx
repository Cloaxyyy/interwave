import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  House,
  MusicNotes,
  MagnifyingGlass,
  Queue,
  GearSix,
  Plus,
  HeartStraight,
  PencilSimple,
  Trash,
  Check,
  X,
  ShieldStar,
  Compass,
} from '@phosphor-icons/react';
import { useUiStore, type View } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  getAllPlaylists, createPlaylist, renamePlaylist, deletePlaylist,
  getPlaylist,
} from '../../lib/tauri';
import type { Playlist } from '../../lib/tauri';

interface NavItem {
  id: View;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home' as View,    label: 'Home',    icon: <House size={17} weight="duotone" /> },
  { id: 'browse' as View,  label: 'Browse',  icon: <Compass size={17} weight="duotone" /> },
  { id: 'library' as View, label: 'Library', icon: <MusicNotes size={17} weight="duotone" /> },
  { id: 'search' as View,  label: 'Search',  icon: <MagnifyingGlass size={17} weight="duotone" /> },
  { id: 'queue' as View,   label: 'Queue',   icon: <Queue size={17} weight="duotone" /> },
];

interface NavButtonProps {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}

function NavButton({ item, active, onClick }: NavButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '9px 12px',
        borderRadius: 8,
        border: 'none',
        background: active ? 'var(--accent-dim)' : hovered ? 'var(--bg-elevated)' : 'transparent',
        cursor: 'pointer',
        color: active ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontFamily: 'var(--sans)',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        width: '100%',
        textAlign: 'left',
        transition: 'color 150ms, background 150ms',
      }}
    >
      {}
      {active && (
        <motion.div
          layoutId="nav-pill-bg"
          style={{
            position: 'absolute', inset: 0,
            background: 'var(--accent-dim)',
            borderRadius: 8, zIndex: 0,
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
      {active && (
        <motion.div
          layoutId="nav-pill-bar"
          style={{
            position: 'absolute', left: -4, top: '20%', bottom: '20%',
            width: 3, borderRadius: 2,
            background: 'var(--accent)', zIndex: 1,
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
      <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center' }}>
        {item.icon}
      </span>
      <span style={{ position: 'relative', zIndex: 1 }}>{item.label}</span>
    </button>
  );
}

function AddPlaylistButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="New playlist"
      style={{
        background: hovered ? 'var(--accent-dim)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: hovered ? 'var(--accent)' : 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        padding: 4,
        borderRadius: 4,
        transition: 'all 120ms',
      }}
    >
      <Plus size={14} weight="bold" />
    </button>
  );
}

function LikedSongsButton({ onClick, active }: { onClick: () => void; active: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: 'calc(100% - 16px)',
        background: active ? 'var(--accent-dim)' : hovered ? 'var(--bg-elevated)' : 'transparent',
        border: 'none',
        borderRadius: 8,
        padding: '6px 10px',
        margin: '2px 8px',
        cursor: 'pointer',
        color: active ? 'var(--text-primary)' : hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontFamily: 'var(--sans)',
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        transition: 'background 120ms, color 120ms',
        textAlign: 'left',
      }}
    >
      {}
      <div style={{
        width: 32, height: 32, borderRadius: 6, flexShrink: 0,
        background: 'var(--grad-twilight)',
        display: 'grid', placeItems: 'center',
        boxShadow: '0 4px 10px -4px rgba(120, 60, 200, 0.5)',
      }}>
        <HeartStraight size={15} weight="fill" color="white" />
      </div>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Liked Songs
      </span>
    </button>
  );
}

function PlaylistCover({ name, thumbnail }: { name: string; thumbnail: string | null }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i);
  const hue = Math.abs(h % 360);
  const bg = thumbnail
    ? `center/cover url(${thumbnail})`
    : `linear-gradient(135deg, oklch(0.55 0.18 ${hue}) 0%, oklch(0.32 0.16 ${(hue + 40) % 360}) 100%)`;
  return (
    <div style={{
      width: 26, height: 26, borderRadius: 4, flexShrink: 0,
      background: bg,
      display: 'grid', placeItems: 'center',
      fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700,
      color: 'rgba(255,255,255,0.85)',
      overflow: 'hidden',
    }}>
      {!thumbnail && (name[0]?.toUpperCase() ?? '♪')}
    </div>
  );
}

function PlaylistRow({
  playlist, isActive, thumbnail,
  onNavigate, onRename, onDelete,
}: {
  playlist: Playlist;
  isActive: boolean;
  thumbnail: string | null;
  onNavigate: (id: string, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(playlist.name);

  const handleSaveEdit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== playlist.name) {
      onRename(playlist.id, trimmed);
    }
    setEditing(false);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !editing && onNavigate(playlist.id, playlist.name)}
      title={playlist.name}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '5px 10px',
        borderRadius: 6,
        margin: '1px 8px',
        background: isActive ? 'var(--accent-dim)' : hovered ? 'var(--bg-elevated)' : 'transparent',
        transition: 'background 120ms',
        minHeight: 36,
        cursor: editing ? 'text' : 'pointer',
        overflow: 'hidden',
      }}
    >
      <PlaylistCover name={playlist.name} thumbnail={thumbnail} />
      {editing ? (
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveEdit();
            if (e.key === 'Escape') { setEditing(false); setEditName(playlist.name); }
          }}
          onBlur={handleSaveEdit}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--accent)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--sans)',
            fontSize: 12,
            outline: 'none',
            padding: '1px 0',
          }}
        />
      ) : (
        <span style={{
          flex: 1, minWidth: 0,
          fontFamily: 'var(--sans)',
          fontSize: 12.5,
          fontWeight: isActive ? 600 : 500,
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          paddingRight: 2,
        }}>
          {playlist.name}
        </span>
      )}

      {hovered && !editing && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            title="Rename"
            onClick={(e) => { e.stopPropagation(); setEditing(true); setEditName(playlist.name); }}
            style={iconButton}
          >
            <PencilSimple size={11} weight="bold" />
          </button>
          <button
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete(playlist.id); }}
            style={iconButton}
          >
            <Trash size={11} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}

const iconButton: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  display: 'flex',
  alignItems: 'center',
  padding: 4,
  borderRadius: 4,
};

export default function Sidebar() {
  const { activeView, setActiveView, setActivePlaylist, bumpLibraryVersion, libraryVersion } = useUiStore();
  const { user, displayName, isStaff } = useAuthStore();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistThumbs, setPlaylistThumbs] = useState<Record<string, string | null>>({});
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    getAllPlaylists()
      .then(setPlaylists)
      .catch(() => setPlaylists([]));
  }, [libraryVersion]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const updates: Record<string, string | null> = {};
      for (const p of playlists) {
        if (playlistThumbs[p.id] !== undefined) continue;
        try {
          const tracks = await getPlaylist(p.id);
          updates[p.id] = tracks.find((t) => t.thumbnail_url)?.thumbnail_url ?? null;
        } catch {
          updates[p.id] = null;
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setPlaylistThumbs((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => { cancelled = true; };

  }, [playlists]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const playlist = await createPlaylist(name);
      setPlaylists((prev) => [...prev, playlist]);
      bumpLibraryVersion();
    } catch (err) {
      console.error('[Sidebar] create playlist failed:', err);
    } finally {
      setCreating(false);
      setNewName('');
    }
  };

  const handleRename = async (id: string, name: string) => {
    try {
      await renamePlaylist(id, name);
      setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    } catch (err) { console.error('[Sidebar] rename failed:', err); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePlaylist(id);
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      bumpLibraryVersion();
      if (useUiStore.getState().activePlaylistId === id) {
        setActiveView('library');
      }
    } catch (err) { console.error('[Sidebar] delete failed:', err); }
  };

  const initials = useMemo(() => {
    const name = displayName ?? user?.email?.split('@')[0] ?? 'You';
    return name[0]?.toUpperCase() ?? '•';
  }, [displayName, user]);

  return (
    <aside
      style={{
        width: 240,

        background: 'linear-gradient(180deg, var(--tint-8) 0%, var(--bg-surface) 35%)',
        borderRight: '1px solid var(--seam)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'background 600ms ease, border-color 600ms ease',
      }}
    >
      {}
      <nav style={{ padding: '12px 8px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <AnimatePresence>
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeView === item.id}
              onClick={() => setActiveView(item.id)}
            />
          ))}
        </AnimatePresence>
        <NavButton
          item={{ id: 'settings' as View, label: 'Settings', icon: <GearSix size={17} weight="duotone" /> }}
          active={activeView === 'settings'}
          onClick={() => setActiveView('settings' as View)}
        />
        {}
        {isStaff && (
          <NavButton
            item={{ id: 'admin' as View, label: 'Admin', icon: <ShieldStar size={17} weight="duotone" /> }}
            active={activeView === 'admin'}
            onClick={() => setActiveView('admin' as View)}
          />
        )}
      </nav>

      {}
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '12px 16px 4px' }} />

      {}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 12px' }}>
        <LikedSongsButton
          active={activeView === 'liked'}
          onClick={() => setActiveView('liked')}
        />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px 6px',
        }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.10em',
            color: 'var(--text-muted)',
            fontFamily: 'var(--sans)',
            textTransform: 'uppercase',
          }}>
            Playlists
          </span>
          <AddPlaylistButton onClick={() => { setCreating(true); setNewName(''); }} />
        </div>

        {playlists.map((playlist) => (
          <PlaylistRow
            key={playlist.id}
            playlist={playlist}
            thumbnail={playlistThumbs[playlist.id] ?? null}
            isActive={useUiStore.getState().activePlaylistId === playlist.id && activeView === 'playlist'}
            onNavigate={(id, name) => setActivePlaylist(id, name)}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        ))}

        {playlists.length === 0 && !creating && (
          <p style={{
            padding: '12px 16px',
            fontFamily: 'var(--sans)',
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}>
            No playlists yet. Hit + to make one.
          </p>
        )}

        {creating && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            margin: '2px 8px',
            background: 'var(--bg-elevated)',
            borderRadius: 8,
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
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'var(--sans)',
                fontSize: 12,
                padding: '6px 4px',
                outline: 'none',
              }}
            />
            <button onClick={handleCreate} style={{ ...iconButton, color: 'var(--accent)' }}>
              <Check size={14} weight="bold" />
            </button>
            <button onClick={() => { setCreating(false); setNewName(''); }} style={iconButton}>
              <X size={14} weight="bold" />
            </button>
          </div>
        )}
      </div>

      {}
      <div
        onClick={() => setActiveView('profile' as View)}
        style={{
          padding: '12px 12px 14px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex', gap: 10, alignItems: 'center',
          cursor: 'pointer',
          transition: 'background 160ms',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: 'var(--grad-violet)',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--serif)', fontSize: 15, color: 'white',
          fontWeight: 500,
          boxShadow: '0 4px 12px -4px var(--accent-deep)',
        }}>{initials}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {displayName ?? user?.email?.split('@')[0] ?? 'Listener'}
          </div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--text-muted)',
            letterSpacing: '0.06em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginTop: 2,
          }}>
            {!isSupabaseConfigured ? 'LOCAL ACCOUNT' : user ? user.email ?? 'SIGNED IN' : 'NOT SIGNED IN'}
          </div>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1 }}>›</div>
      </div>
    </aside>
  );
}
