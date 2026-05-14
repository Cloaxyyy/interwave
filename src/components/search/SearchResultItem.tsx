import { useState } from 'react';

/** Extract a readable message from whatever Tauri throws.
 *  Tauri errors arrive as plain objects: { kind: "YtDlp", message: "..." }
 *  not as JS Error instances, so instanceof Error is always false. */
function tauriErrMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    if (typeof o.kind === 'string' && typeof o.message !== 'undefined')
      return `${o.kind}: ${o.message}`;
    try { return JSON.stringify(err); } catch { /* fall through */ }
  }
  return String(err);
}
import { Play, MusicNote, Heart, Plus, CircleNotch } from '@phosphor-icons/react';
import type { SearchResult, Track } from '../../lib/tauri';
import { saveTrackFromSearch, likeTrack, unlikeTrack } from '../../lib/tauri';
import { toast } from '../../stores/toastStore';
import { cleanTrackTitle } from '../../lib/cleanTitle';
import PlaylistPickerModal from '../library/PlaylistPickerModal';

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SearchResultItemProps {
  result: SearchResult;
  onPlay: (result: SearchResult) => Promise<void>;
  isPlaying: boolean;
  isLoading: boolean; // true while this specific track is loading
}

export default function SearchResultItem({ result, onPlay, isPlaying, isLoading }: SearchResultItemProps) {
  const [hovered, setHovered] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [trackForPlaylist, setTrackForPlaylist] = useState<Track | null>(null);
  const [saving, setSaving] = useState(false);

  const busy = localLoading || isLoading;

  const handlePlay = async () => {
    if (busy) return;
    setPlayError(null);
    setLocalLoading(true);
    try {
      await onPlay(result);
    } catch (err: unknown) {
      const msg = tauriErrMsg(err);
      setPlayError(msg);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (liking) return;
    setActionError(null);
    setLiking(true);
    try {
      const track = await saveTrackFromSearch(
        result.youtube_id,
        result.title,
        result.artist,
        result.duration_seconds,
        result.thumbnail_url,
      );
      if (liked || track.liked) {
        await unlikeTrack(track.id);
        setLiked(false);
        toast.info('Removed from Liked Songs');
      } else {
        await likeTrack(track.id);
        setLiked(true);
        toast.success('Added to Liked Songs', result.title);
      }
    } catch (err: unknown) {
      setActionError(tauriErrMsg(err));
    } finally {
      setLiking(false);
    }
  };

  const handleAddToPlaylist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saving) return;
    setActionError(null);
    setSaving(true);
    try {
      const track = await saveTrackFromSearch(
        result.youtube_id,
        result.title,
        result.artist,
        result.duration_seconds,
        result.thumbnail_url,
      );
      setTrackForPlaylist(track);
    } catch (err: unknown) {
      setActionError(tauriErrMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const isActive = isPlaying || busy;

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handlePlay}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          borderRadius: 6,
          background: hovered ? 'var(--bg-elevated)' : 'transparent',
          cursor: busy ? 'wait' : 'pointer',
          transition: 'background 120ms',
        }}
      >
        {/* Thumbnail */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 4,
            overflow: 'hidden',
            background: 'var(--bg-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          {result.thumbnail_url ? (
            <img
              src={result.thumbnail_url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              draggable={false}
            />
          ) : (
            <MusicNote size={20} weight="duotone" color="var(--text-muted)" />
          )}

          {/* Overlay: spinner while loading, play icon on hover */}
          {(busy || hovered) && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {busy ? (
                <CircleNotch
                  size={20}
                  weight="bold"
                  color="var(--accent)"
                  style={{ animation: 'spin 0.8s linear infinite' }}
                />
              ) : (
                <Play size={20} weight="fill" color="var(--accent)" />
              )}
            </div>
          )}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              color: isActive ? 'var(--accent)' : 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {cleanTrackTitle(result.title)}
          </p>
          <p
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {result.artist}
          </p>
        </div>

        {busy && (
          <span style={{
            fontFamily: 'var(--sans)', fontSize: 11,
            color: 'var(--accent)', flexShrink: 0,
          }}>
            Loading…
          </span>
        )}

        {/* Action buttons — always visible (hover-only was hard to discover) */}
        {!busy && (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <ActionBtn
              title={liked ? 'Unlike' : 'Like this song'}
              active={liked}
              spinning={liking}
              onClick={handleLike}
            >
              <Heart size={16} weight={liked ? 'fill' : 'regular'} />
            </ActionBtn>
            <ActionBtn
              title="Add to playlist"
              spinning={saving}
              onClick={handleAddToPlaylist}
            >
              <Plus size={16} weight="bold" />
            </ActionBtn>
          </div>
        )}

        {!busy && result.duration_seconds !== null && (
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 11,
            color: 'var(--text-muted)',
            flexShrink: 0, minWidth: 38, textAlign: 'right',
          }}>
            {formatDuration(result.duration_seconds)}
          </span>
        )}
      </div>

      {/* Play error shown below the row */}
      {playError && (
        <div style={{
          padding: '4px 16px 6px',
          fontSize: 11,
          fontFamily: 'Syne, sans-serif',
          color: 'var(--destructive)',
          background: 'rgba(255,68,68,0.06)',
          borderRadius: '0 0 6px 6px',
        }}>
          ⚠ {playError}
        </div>
      )}

      {/* Action error (like / add to playlist) */}
      {actionError && (
        <div style={{
          padding: '4px 16px 6px',
          fontSize: 11,
          fontFamily: 'Syne, sans-serif',
          color: 'var(--destructive)',
          background: 'rgba(255,68,68,0.06)',
          borderRadius: '0 0 6px 6px',
        }}>
          ⚠ {actionError}
        </div>
      )}

      {/* Playlist picker modal — rendered outside the row so it's not clipped */}
      {trackForPlaylist && (
        <PlaylistPickerModal
          track={trackForPlaylist}
          onClose={() => setTrackForPlaylist(null)}
        />
      )}

      {/* Spin keyframe (scoped) */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function ActionBtn({
  children,
  title,
  active = false,
  spinning = false,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  active?: boolean;
  spinning?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={title}
      disabled={spinning}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: spinning ? 'wait' : 'pointer',
        color: active
          ? 'var(--accent)'
          : hovered
          ? 'var(--text-primary)'
          : 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 5,
        borderRadius: 4,
        opacity: spinning ? 0.5 : 1,
        transition: 'color 120ms, opacity 120ms',
      }}
    >
      {children}
    </button>
  );
}
