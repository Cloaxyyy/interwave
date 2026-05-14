import React from 'react';
import { MusicNote, CircleNotch, MicrophoneStage, WifiSlash } from '@phosphor-icons/react';
import { seek } from '../../lib/tauri';
import { usePlayerStore } from '../../stores/playerStore';
import { useUiStore } from '../../stores/uiStore';
import { useOnlineStore } from '../../lib/online';
import { cleanTrackTitle } from '../../lib/cleanTitle';
import PlaybackControls from '../player/PlaybackControls';
import VolumeControl from '../player/VolumeControl';
import SleepTimer from '../player/SleepTimer';

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Inline progress bar (Apple Music puts it visibly under the mini player).
function InlineProgressBar() {
  const { position, duration } = usePlayerStore();
  const [dragging, setDragging] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [dragFraction, setDragFraction] = React.useState<number | null>(null);
  const barRef = React.useRef<HTMLDivElement>(null);

  const fractionAt = (clientX: number): number => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    setDragFraction(fractionAt(e.clientX));
  };

  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => setDragFraction(fractionAt(e.clientX));
    const onUp = (e: MouseEvent) => {
      const frac = fractionAt(e.clientX);
      setDragFraction(null);
      setDragging(false);
      if (duration > 0) {
        const safePos = Math.max(0, Math.min(frac * duration, duration - 0.5));
        seek(safePos).catch(console.error);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, duration]);

  const progress = dragFraction !== null
    ? dragFraction * 100
    : (duration > 0 ? (position / duration) * 100 : 0);
  const active = hovered || dragging;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10,
        color: 'var(--text-muted)', minWidth: 32, textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatTime(position)}
      </span>
      <div
        ref={barRef}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          flex: 1, position: 'relative',
          height: active ? 6 : 4,
          background: 'var(--bg-overlay)',
          borderRadius: 3,
          cursor: duration > 0 ? 'pointer' : 'default',
          transition: 'height 120ms ease',
        }}
      >
        <div style={{
          width: `${progress}%`, height: '100%',
          background: 'var(--accent-live)',
          borderRadius: 3,
          transition: dragging ? 'none' : 'width 200ms linear',
        }} />
        {active && duration > 0 && (
          <div style={{
            position: 'absolute', top: '50%', left: `${progress}%`,
            transform: 'translate(-50%, -50%)',
            width: 12, height: 12, borderRadius: '50%',
            background: 'var(--accent-live)',
            boxShadow: '0 0 0 4px color-mix(in oklch, var(--accent-live) 28%, transparent), 0 2px 6px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
          }} />
        )}
      </div>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10,
        color: 'var(--text-muted)', minWidth: 32,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatTime(duration)}
      </span>
    </div>
  );
}

export default function PlayerBar() {
  const { currentTrack, playbackState, playbackError } = usePlayerStore();
  const url = currentTrack?.thumbnail_url ?? null;
  const isLoading = playbackState === 'loading';

  return (
    <div
      style={{
        height: 92,
        // Tinted from the SHARED --accent-live var so this matches the
        // sidebar / panel / hero exactly. No more "each component picks
        // its own accent percentage" mismatch.
        background: `
          linear-gradient(180deg, var(--tint-12) 0%, var(--bg-glass) 100%)
        `,
        backdropFilter: 'blur(28px) saturate(150%)',
        WebkitBackdropFilter: 'blur(28px) saturate(150%)',
        borderTop: '1px solid var(--seam)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
        zIndex: 5,
        transition: 'background 600ms ease, border-color 600ms ease',
      }}
    >
      {/* Loading shimmer */}
      {isLoading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 2, background: 'var(--bg-overlay)', overflow: 'hidden',
        }}>
          <div
            style={{
              height: '100%',
              background: 'var(--grad-violet)',
              animation: 'playerLoadingBar 1.6s ease-in-out infinite',
            }}
          />
          <style>{`
            @keyframes playerLoadingBar {
              0%   { width: 0%;   margin-left: 0%; }
              50%  { width: 60%;  margin-left: 20%; }
              100% { width: 0%;   margin-left: 100%; }
            }
          `}</style>
        </div>
      )}

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '300px 1fr 300px',
        alignItems: 'center',
        padding: '10px 22px',
        gap: 18,
        minHeight: 0,
      }}>

        {/* ── Left: mini-art + info ─────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 8,
            overflow: 'hidden', flexShrink: 0, position: 'relative',
            background: url ? 'transparent' : 'var(--bg-overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px -4px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
          }}>
            {url ? (
              <img src={url} alt="" draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <MusicNote size={20} weight="duotone" color="var(--text-muted)" />
            )}
            {isLoading && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.55)',
                display: 'grid', placeItems: 'center',
              }}>
                <CircleNotch size={20} weight="bold" color="var(--accent)"
                  style={{ animation: 'spin 0.9s linear infinite' }} />
              </div>
            )}
          </div>
          <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
            <p style={{
              fontFamily: 'var(--sans)',
              fontSize: 13, fontWeight: 600,
              color: isLoading ? 'var(--accent)' : 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 2,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentTrack ? cleanTrackTitle(currentTrack.title) : (isLoading ? 'Loading…' : 'Nothing playing')}
              </span>
              <OfflineBadge/>
            </p>
            <p style={{
              fontFamily: 'var(--sans)', fontSize: 11,
              color: 'var(--text-secondary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {currentTrack?.artist ?? '—'}
            </p>
          </div>
        </div>

        {/* ── Center: controls + inline progress ────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 4, minWidth: 0,
        }}>
          <PlaybackControls variant="full" />
          <InlineProgressBar />
        </div>

        {/* ── Right: lyrics fullscreen + sleep + volume ──────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 10, minWidth: 0,
        }}>
          <LyricsButton />
          <SleepTimer />
          <VolumeControl />
        </div>
      </div>

      {/* Playback error toast — slides above */}
      {playbackError && (
        <div style={{
          position: 'absolute',
          bottom: '100%', left: 0, right: 0,
          background: 'rgba(255,60,60,0.10)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,60,60,0.25)',
          padding: '6px 18px',
          fontSize: 11, fontFamily: 'var(--sans)',
          color: 'var(--destructive)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>⚠</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {playbackError}
          </span>
          <button
            onClick={() => usePlayerStore.getState().setPlaybackError(null)}
            style={{
              background: 'none', border: 'none',
              color: 'var(--destructive)', cursor: 'pointer',
              padding: 0, fontSize: 13, lineHeight: 1,
            }}
          >×</button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Tiny "Offline" pill — appears next to the track title when the network
// is down. Lets the user know why playback is stuttering instead of
// cryptic errors.
function OfflineBadge() {
  const online = useOnlineStore((s) => s.online);
  if (online) return null;
  return (
    <span title="No internet connection — playback may stall" style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 999,
      background: 'oklch(0.40 0.18 50)',
      color: '#fff',
      fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      flexShrink: 0,
    }}>
      <WifiSlash size={9} weight="fill"/>
      Offline
    </span>
  );
}

// Toggle button for the fullscreen karaoke-lyrics overlay.
// Mic icon, sits between SleepTimer and VolumeControl in the player bar.
// Can be hidden via Settings → Sound → "Show fullscreen lyrics button" toggle
// (saved to iw_show_fs_lyrics_btn) for users who only want the panel mini-view.
function LyricsButton() {
  const lyricsFs = useUiStore((s) => s.lyricsFullscreen);
  const setLyricsFs = useUiStore((s) => s.setLyricsFullscreen);
  const [hovered, setHovered] = React.useState(false);
  const [show, setShow] = React.useState(() => {
    try { return localStorage.getItem('iw_show_fs_lyrics_btn') !== '0'; } catch { return true; }
  });
  React.useEffect(() => {
    const onChange = () => {
      try { setShow(localStorage.getItem('iw_show_fs_lyrics_btn') !== '0'); } catch {}
    };
    window.addEventListener('iw:settings-changed', onChange);
    return () => window.removeEventListener('iw:settings-changed', onChange);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => setLyricsFs(!lyricsFs)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={lyricsFs ? 'Close fullscreen lyrics' : 'Fullscreen lyrics'}
      style={{
        background: lyricsFs ? 'var(--accent-dim)' : 'transparent',
        border: 'none',
        borderRadius: 6,
        width: 32, height: 32,
        display: 'grid', placeItems: 'center',
        cursor: 'pointer',
        color: lyricsFs
          ? 'var(--accent)'
          : hovered ? 'var(--text-primary)' : 'var(--text-muted)',
        transition: 'background 150ms, color 150ms',
      }}
    >
      <MicrophoneStage size={16} weight={lyricsFs ? 'fill' : 'regular'} />
    </button>
  );
}
