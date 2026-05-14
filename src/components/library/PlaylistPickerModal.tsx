import { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { getAllPlaylists, addTrackToPlaylist } from '../../lib/tauri';
import type { Playlist, Track } from '../../lib/tauri';
import { useUiStore } from '../../stores/uiStore';
import { toast } from '../../stores/toastStore';

interface PlaylistPickerModalProps {
  track: Track;
  onClose: () => void;
}

export default function PlaylistPickerModal({ track, onClose }: PlaylistPickerModalProps) {
  const bumpLibraryVersion = useUiStore((s) => s.bumpLibraryVersion);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null); // playlist id being added
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllPlaylists()
      .then(setPlaylists)
      .catch(() => setPlaylists([]))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (playlist: Playlist) => {
    setAdding(playlist.id);
    setError(null);
    try {
      await addTrackToPlaylist(playlist.id, track);
      bumpLibraryVersion();
      toast.success(`Added to ${playlist.name}`, track.title);
      onClose();
    } catch (err) {
      console.error('[PlaylistPickerModal] add failed:', err);
      setAdding(null);
      setError(typeof err === 'string' ? err : (err as Error)?.message ?? 'Failed to add track');
    }
  };

  return (
    // Backdrop
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      {/* Modal panel */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          width: 280,
          maxHeight: 400,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px 10px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <p
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Add to playlist
            </p>
            <p
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: 11,
                color: 'var(--text-muted)',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 200,
              }}
            >
              {track.title}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              padding: 4,
            }}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div
            style={{
              padding: '8px 16px',
              background: 'rgba(255,68,68,0.12)',
              borderBottom: '1px solid rgba(255,68,68,0.25)',
              color: '#ff6b6b',
              fontFamily: 'Syne, sans-serif',
              fontSize: 11,
            }}
          >
            {error}
          </div>
        )}

        {/* Playlist list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <p
              style={{
                padding: '16px',
                fontFamily: 'Syne, sans-serif',
                fontSize: 12,
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              Loading playlists…
            </p>
          )}
          {!loading && playlists.length === 0 && (
            <p
              style={{
                padding: '16px',
                fontFamily: 'Syne, sans-serif',
                fontSize: 12,
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              No playlists yet. Create one in the sidebar.
            </p>
          )}
          {!loading &&
            playlists.map((playlist) => (
              <PlaylistOption
                key={playlist.id}
                playlist={playlist}
                onAdd={handleAdd}
                isAdding={adding === playlist.id}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

function PlaylistOption({
  playlist,
  onAdd,
  isAdding,
}: {
  playlist: Playlist;
  onAdd: (p: Playlist) => void;
  isAdding: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !isAdding && onAdd(playlist)}
      style={{
        padding: '10px 16px',
        fontFamily: 'Syne, sans-serif',
        fontSize: 13,
        color: isAdding ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: hovered && !isAdding ? 'var(--bg-overlay)' : 'transparent',
        cursor: isAdding ? 'wait' : 'pointer',
        transition: 'background 100ms, color 100ms',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {isAdding ? 'Adding…' : playlist.name}
    </div>
  );
}
