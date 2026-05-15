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

function InlineProgressBar() {
  const { position, duration } = usePlayerStore();
  const [dragging, setDragging] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [dragFraction, setDragFraction] = React.useState<number | null>(null);
  const [hoverFraction, setHoverFraction] = React.useState<number | null>(null);
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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) setHoverFraction(fractionAt(e.clientX));
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
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setHoverFraction(null); }}
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
        {hovered && hoverFraction !== null && duration > 0 && (
          <div style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: `${hoverFraction * 100}%`,
            transform: 'translateX(-50%)',
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--mono)', fontSize: 10.5,
            fontVariantNumeric: 'tabular-nums',
            padding: '4px 8px', borderRadius: 5,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
          }}>
            {formatTime(hoverFraction * duration)}
          </div>
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
    <div className="iw-player" style={{ position: 'relative' }}>
      {isLoading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 2, background: 'var(--bg-overlay)', overflow: 'hidden', zIndex: 2,
        }}>
          <div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, var(--accent), var(--accent-deep))',
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

      {/* LEFT — now-playing meta */}
      <div className="iw-now-meta">
        <div className="iw-now-art" style={{ display: 'grid', placeItems: 'center', position: 'relative' }}>
          {url ? (
            <img src={url} alt="" draggable={false} />
          ) : (
            <MusicNote size={20} weight="duotone" color="var(--text-muted)" />
          )}
          {isLoading && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.55)',
              display: 'grid', placeItems: 'center',
            }}>
              <CircleNotch size={18} weight="bold" color="var(--accent)"
                style={{ animation: 'spin 0.9s linear infinite' }} />
            </div>
          )}
        </div>
        <div className="iw-now-text">
          <div className="iw-nt" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentTrack ? cleanTrackTitle(currentTrack.title) : (isLoading ? 'Loading…' : 'Nothing playing')}
            </span>
            <OfflineBadge/>
          </div>
          <button className="iw-na">{currentTrack?.artist ?? '—'}</button>
        </div>
      </div>

      {/* CENTER — transport + scrub */}
      <div className="iw-player-center">
        <PlaybackControls variant="full" />
        <InlineProgressBar />
      </div>

      {/* RIGHT — secondary controls */}
      <div className="iw-player-right">
        <LyricsButton />
        <SleepTimer />
        <VolumeControl />
      </div>

      {}
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
