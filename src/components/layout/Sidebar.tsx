import { useState, useEffect, useMemo, useRef } from 'react';
import {
  MagnifyingGlass,
  Plus,
  ListBullets,
  GridFour,
  CaretDown,
  CaretUp,
  X,
  Check,
  PencilSimple,
  Trash,
  HeartStraight,
  ArrowsOutSimple,
} from '@phosphor-icons/react';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useUpdateStore } from '../../lib/updater';
import {
  getAllPlaylists, createPlaylist, renamePlaylist, deletePlaylist,
  getPlaylist,
} from '../../lib/tauri';
import type { Playlist } from '../../lib/tauri';

type SortMode = 'recent' | 'added' | 'alpha' | 'creator';
type ViewMode = 'list' | 'list-compact' | 'grid' | 'grid-compact';
type FilterPill = 'all' | 'playlists' | 'liked';

const APP_VERSION = '0.7.0';

export default function Sidebar() {
  const { activeView, setActiveView, setActivePlaylist, bumpLibraryVersion, libraryVersion } = useUiStore();
  const { user, displayName } = useAuthStore();
  const updateStatus = useUpdateStore((s) => s.status);
  const newVersion = useUpdateStore((s) => s.newVersion);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const [trackCounts, setTrackCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<FilterPill>('all');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [libExpanded, setLibExpanded] = useState(true);
  const [librarySearch, setLibrarySearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAllPlaylists().then(setPlaylists).catch(() => setPlaylists([]));
  }, [libraryVersion]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const thumbUpdates: Record<string, string | null> = {};
      const countUpdates: Record<string, number> = {};
      for (const p of playlists) {
        if (thumbs[p.id] !== undefined && trackCounts[p.id] !== undefined) continue;
        try {
          const tracks = await getPlaylist(p.id);
          thumbUpdates[p.id] = tracks.find((t) => t.thumbnail_url)?.thumbnail_url ?? null;
          countUpdates[p.id] = tracks.length;
        } catch {
          thumbUpdates[p.id] = null;
          countUpdates[p.id] = 0;
        }
      }
      if (!cancelled) {
        if (Object.keys(thumbUpdates).length > 0) setThumbs((prev) => ({ ...prev, ...thumbUpdates }));
        if (Object.keys(countUpdates).length > 0) setTrackCounts((prev) => ({ ...prev, ...countUpdates }));
      }
    })();
    return () => { cancelled = true; };

  }, [playlists, libraryVersion]);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const p = await createPlaylist(name);
      setPlaylists((prev) => [...prev, p]);
      bumpLibraryVersion();
    } catch (e) { console.error(e); }
    finally { setCreating(false); setNewName(''); }
  };

  const handleRename = async (id: string, name: string) => {
    try {
      await renamePlaylist(id, name);
      setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePlaylist(id);
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      bumpLibraryVersion();
      if (useUiStore.getState().activePlaylistId === id) setActiveView('library');
    } catch (e) { console.error(e); }
  };

  const sortedFiltered = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    let list = playlists.filter((p) => !q || p.name.toLowerCase().includes(q));
    switch (sortMode) {
      case 'recent':  list = [...list].sort((a, b) => b.updated_at - a.updated_at); break;
      case 'added':   list = [...list].sort((a, b) => b.created_at - a.created_at); break;
      case 'alpha':   list = [...list].sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'creator': list = [...list]; break;
    }
    return list;
  }, [playlists, librarySearch, sortMode]);

  const updateAvailable = updateStatus === 'available';

  return (
    <aside
      style={{
        width: 280,
        background: 'linear-gradient(180deg, var(--tint-8) 0%, var(--bg-surface) 60%, var(--bg-base) 100%)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'background 600ms ease',
      }}
    >
      {}
      {updateAvailable && (
        <div
          onClick={() => {}}
          style={{
            margin: '6px 12px',
            padding: '10px 12px',
            background: 'color-mix(in oklch, var(--accent-live) 10%, var(--bg-surface))',
            border: '1px solid color-mix(in oklch, var(--accent-live) 35%, transparent)',
            borderRadius: 10,
            cursor: 'default',
          }}
        >
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--accent)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>
            What's new from Interwave
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
            v{newVersion ?? APP_VERSION} is ready
          </div>
        </div>
      )}

      {}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, paddingTop: 4 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px 4px',
        }}>
          <button
            onClick={() => setLibExpanded((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', padding: '4px 6px',
              borderRadius: 6,
              transition: 'color 120ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            {libExpanded ? <CaretDown size={11} weight="bold" /> : <CaretUp size={11} weight="bold" />}
            Your Library
          </button>
          <div style={{ display: 'flex', gap: 2 }}>
            <SmallIconButton title="Create playlist" onClick={() => { setCreating(true); setNewName(''); setLibExpanded(true); }}>
              <Plus size={13} weight="bold" />
            </SmallIconButton>
            <SmallIconButton title="Expand Library to full screen" onClick={() => useUiStore.getState().setLibraryExpanded(true)}>
              <ArrowsOutSimple size={12} weight="bold" />
            </SmallIconButton>
          </div>
        </div>

        {libExpanded && (
          <>
            {}
            <div style={{ padding: '4px 12px 6px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([
                { id: 'all',       label: 'All' },
                { id: 'playlists', label: 'Playlists' },
                { id: 'liked',     label: 'Liked' },
              ] as const).map(({ id, label }) => {
                const active = filter === id;
                return (
                  <button
                    key={id}
                    onClick={() => setFilter(active ? 'all' : id)}
                    style={{
                      padding: '4px 11px',
                      borderRadius: 999,
                      background: active ? 'var(--text-primary)' : 'var(--bg-elevated)',
                      color: active ? 'var(--bg-base)' : 'var(--text-secondary)',
                      border: 'none',
                      fontFamily: 'var(--sans)', fontSize: 11.5,
                      fontWeight: active ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 120ms',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {}
            <div style={{ padding: '4px 12px 4px', display: 'flex', gap: 6 }}>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6, padding: '5px 9px',
              }}>
                <MagnifyingGlass size={11} weight="bold" color="var(--text-muted)" />
                <input
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search in library"
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--text-primary)', fontFamily: 'var(--sans)', fontSize: 11.5,
                  }}
                />
              </div>
              <SortMenu mode={sortMode} onChange={setSortMode} />
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            </div>

            {}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 12px' }}>
              {filter !== 'playlists' && (
                <LikedSongsButton active={activeView === 'liked'} onClick={() => setActiveView('liked')} viewMode={viewMode} />
              )}

              {creating && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', margin: '2px 12px',
                  background: 'var(--bg-elevated)', borderRadius: 6,
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
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      color: 'var(--text-primary)', fontFamily: 'var(--sans)', fontSize: 12,
                    }}
                  />
                  <SmallIconButton title="Save" onClick={handleCreate}><Check size={12} weight="bold" /></SmallIconButton>
                  <SmallIconButton title="Cancel" onClick={() => { setCreating(false); setNewName(''); }}><X size={12} weight="bold" /></SmallIconButton>
                </div>
              )}

              {sortedFiltered.length === 0 && !creating && (
                <p style={{
                  padding: '12px 16px', fontFamily: 'var(--sans)', fontSize: 11,
                  color: 'var(--text-muted)', lineHeight: 1.5,
                }}>
                  {playlists.length === 0 ? 'No playlists yet. Hit + to make one.' : 'No matches.'}
                </p>
              )}

              {filter !== 'liked' && (
                viewMode === 'list' || viewMode === 'list-compact' ? (
                  sortedFiltered.map((p) => (
                    <PlaylistListRow
                      key={p.id} playlist={p}
                      thumbnail={thumbs[p.id] ?? null}
                      trackCount={trackCounts[p.id]}
                      ownerName={displayName ?? user?.email?.split('@')[0] ?? 'You'}
                      isActive={useUiStore.getState().activePlaylistId === p.id && activeView === 'playlist'}
                      compact={viewMode === 'list-compact'}
                      onNavigate={(id, name) => setActivePlaylist(id, name)}
                      onRename={handleRename} onDelete={handleDelete}
                    />
                  ))
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: viewMode === 'grid-compact' ? 'repeat(auto-fill, minmax(54px, 1fr))' : 'repeat(auto-fill, minmax(86px, 1fr))',
                    gap: 8,
                    padding: '6px 12px',
                  }}>
                    {sortedFiltered.map((p) => (
                      <PlaylistGridCard
                        key={p.id} playlist={p}
                        thumbnail={thumbs[p.id] ?? null}
                        compact={viewMode === 'grid-compact'}
                        onNavigate={(id, name) => setActivePlaylist(id, name)}
                      />
                    ))}
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>

    </aside>
  );
}


function SmallIconButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--text-muted)',
        padding: 5, borderRadius: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 120ms',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}



function SortMenu({ mode, onChange }: { mode: SortMode; onChange: (m: SortMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const labels: Record<SortMode, string> = { recent: 'Recent', added: 'Recently added', alpha: 'A → Z', creator: 'Creator' };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Sort"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 8px', borderRadius: 6,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--sans)', fontSize: 10.5,
          cursor: 'pointer',
        }}
      >
        {labels[mode]}
        <CaretDown size={9} weight="bold" />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 8, overflow: 'hidden', minWidth: 140, zIndex: 30,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {(Object.entries(labels) as [SortMode, string][]).map(([k, v]) => (
            <button
              key={k}
              onClick={() => { onChange(k); setOpen(false); }}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '7px 12px',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                color: mode === k ? 'var(--accent)' : 'var(--text-primary)',
                fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: mode === k ? 600 : 500,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-overlay)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {v}
              {mode === k && <Check size={11} weight="bold" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const items: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'list',          label: 'Default list', icon: <ListBullets size={11} weight="bold" /> },
    { mode: 'list-compact',  label: 'Compact list', icon: <ListBullets size={11} /> },
    { mode: 'grid',          label: 'Default grid', icon: <GridFour size={11} weight="bold" /> },
    { mode: 'grid-compact',  label: 'Compact grid', icon: <GridFour size={11} /> },
  ];
  const cur = items.find((i) => i.mode === mode)!;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="View"
        style={{
          padding: '5px 7px', borderRadius: 6,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center',
        }}
      >
        {cur.icon}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 8, overflow: 'hidden', minWidth: 150, zIndex: 30,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {items.map((i) => (
            <button
              key={i.mode}
              onClick={() => { onChange(i.mode); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 12px',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                color: mode === i.mode ? 'var(--accent)' : 'var(--text-primary)',
                fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: mode === i.mode ? 600 : 500,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-overlay)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {i.icon}
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LikedSongsButton({ active, onClick, viewMode }: { active: boolean; onClick: () => void; viewMode: ViewMode }) {
  if (viewMode === 'grid' || viewMode === 'grid-compact') {
    return (
      <button
        onClick={onClick}
        title="Liked Songs"
        style={{
          margin: '4px 12px',
          padding: 0, border: 'none', cursor: 'pointer',
          background: 'transparent',
          display: 'block',
        }}
      >
        <div style={{
          aspectRatio: '1', borderRadius: 6,
          background: 'var(--grad-twilight)',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 4px 10px -4px rgba(120, 60, 200, 0.5)',
        }}>
          <HeartStraight size={20} weight="fill" color="white" />
        </div>
        {viewMode === 'grid' && (
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600,
            color: active ? 'var(--accent)' : 'var(--text-primary)',
            marginTop: 4, textAlign: 'left',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>Liked Songs</div>
        )}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: 'calc(100% - 16px)', margin: '2px 8px',
        background: active ? 'rgba(80, 220, 100, 0.10)' : 'transparent',
        border: 'none', borderRadius: 6,
        padding: '5px 8px',
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)'; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 5, flexShrink: 0,
        background: 'linear-gradient(135deg, oklch(0.55 0.18 280), oklch(0.45 0.20 230))',
        display: 'grid', placeItems: 'center',
        boxShadow: '0 4px 10px -4px rgba(120, 60, 200, 0.5)',
      }}>
        <HeartStraight size={18} weight="fill" color="white" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
          color: active ? 'oklch(0.78 0.18 145)' : 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>Liked Songs</div>
        <div style={{
          fontFamily: 'var(--sans)', fontSize: 11,
          color: active ? 'oklch(0.78 0.18 145)' : 'var(--text-muted)',
          marginTop: 1,
        }}>Playlist</div>
      </div>
    </button>
  );
}

function PlaylistListRow({
  playlist, isActive, thumbnail, trackCount, ownerName, compact,
  onNavigate, onRename, onDelete,
}: {
  playlist: Playlist; isActive: boolean; thumbnail: string | null;
  trackCount?: number; ownerName?: string;
  compact: boolean;
  onNavigate: (id: string, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(playlist.name);

  const saveEdit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== playlist.name) onRename(playlist.id, trimmed);
    setEditing(false);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !editing && onNavigate(playlist.id, playlist.name)}
      title={playlist.name}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: compact ? '3px 10px' : '5px 10px',
        margin: '1px 8px', borderRadius: 6,
        background: isActive ? 'var(--accent-dim)' : hovered ? 'var(--bg-elevated)' : 'transparent',
        cursor: editing ? 'text' : 'pointer',
        transition: 'background 120ms',
        minHeight: compact ? 28 : 40,
      }}
    >
      {!compact && (
        <PlaylistCover name={playlist.name} thumbnail={thumbnail} size={40} />
      )}
      {editing ? (
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') { setEditing(false); setEditName(playlist.name); }
          }}
          onBlur={saveEdit}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            borderBottom: '1px solid var(--accent)',
            color: 'var(--text-primary)', fontFamily: 'var(--sans)', fontSize: 12,
          }}
        />
      ) : (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--sans)', fontSize: compact ? 12 : 13,
            fontWeight: isActive ? 600 : 500,
            color: isActive ? 'var(--accent)' : 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{playlist.name}</div>
          {!compact && (
            <div style={{
              fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)',
              marginTop: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              Playlist
              {ownerName ? ` · ${ownerName}` : ''}
              {typeof trackCount === 'number' && trackCount > 0
                ? ` · ${trackCount} ${trackCount === 1 ? 'song' : 'songs'}`
                : ''}
            </div>
          )}
        </div>
      )}
      {hovered && !editing && (
        <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <SmallIconButton title="Rename" onClick={(() => { setEditing(true); setEditName(playlist.name); }) as any}><PencilSimple size={11} weight="bold" /></SmallIconButton>
          <SmallIconButton title="Delete" onClick={(() => onDelete(playlist.id)) as any}><Trash size={11} weight="bold" /></SmallIconButton>
        </div>
      )}
    </div>
  );
}

function PlaylistGridCard({ playlist, thumbnail, compact, onNavigate }: { playlist: Playlist; thumbnail: string | null; compact: boolean; onNavigate: (id: string, name: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => onNavigate(playlist.id, playlist.name)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={compact ? playlist.name : undefined}
      style={{
        position: 'relative',
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: 0, textAlign: 'left',
      }}
    >
      <PlaylistCover name={playlist.name} thumbnail={thumbnail} size="100%" />
      {!compact && (
        <div style={{
          fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600,
          color: 'var(--text-primary)', marginTop: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{playlist.name}</div>
      )}
      {compact && hovered && (
        <div style={{
          position: 'absolute', top: '100%', left: '50%',
          transform: 'translate(-50%, 4px)',
          background: 'var(--bg-overlay)', border: '1px solid var(--border-default)',
          borderRadius: 5, padding: '4px 8px',
          fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 500,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap', pointerEvents: 'none',
          zIndex: 10,
        }}>{playlist.name}</div>
      )}
    </button>
  );
}

function PlaylistCover({ name, thumbnail, size }: { name: string; thumbnail: string | null; size: number | string }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i);
  const hue = Math.abs(h % 360);
  const dim = typeof size === 'number' ? `${size}px` : size;
  return (
    <div style={{
      width: dim,
      ...(typeof size === 'number' ? { height: dim } : { aspectRatio: '1' }),
      borderRadius: 5, flexShrink: 0,
      background: thumbnail
        ? `center/cover url(${thumbnail})`
        : `linear-gradient(135deg, oklch(0.55 0.18 ${hue}) 0%, oklch(0.32 0.16 ${(hue + 40) % 360}) 100%)`,
      display: 'grid', placeItems: 'center',
      fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700,
      color: 'rgba(255,255,255,0.85)',
      overflow: 'hidden',
    }}>
      {!thumbnail && (name[0]?.toUpperCase() ?? '♪')}
    </div>
  );
}
