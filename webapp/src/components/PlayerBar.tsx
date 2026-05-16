import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  MusicNote,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  Spinner,
} from '@phosphor-icons/react';
import { usePlayerStore } from '../stores/playerStore';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function PlayerBar() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const state = usePlayerStore((s) => s.state);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const error = usePlayerStore((s) => s.error);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);

  const progressRef = useRef<HTMLDivElement | null>(null);

  if (!currentTrack) return null;

  // Prefer the live audio duration; fall back to the stored value while the
  // stream is still loading so the bar doesn't sit at 0:00.
  const effectiveDuration = duration > 0 ? duration : currentTrack.duration_seconds ?? 0;
  const pct = effectiveDuration > 0 ? Math.min(100, (position / effectiveDuration) * 100) : 0;

  function seekToPointer(ev: ReactPointerEvent<HTMLDivElement>): void {
    const el = progressRef.current;
    if (!el || effectiveDuration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
    seek(ratio * effectiveDuration);
  }

  const loading = state === 'loading';
  const playing = state === 'playing';
  const hasError = state === 'error';

  return (
    <div className="iw-player-bar" role="region" aria-label="Player">
      <div className="iw-player-row">
        <div className="iw-player-art" aria-hidden="true">
          {currentTrack.thumbnail_url ? (
            <img src={currentTrack.thumbnail_url} alt="" draggable={false} />
          ) : (
            <MusicNote size={18} weight="duotone" />
          )}
        </div>
        <div className="iw-player-meta">
          <div className="iw-player-title">{currentTrack.title}</div>
          <div className="iw-player-artist">
            {hasError && <span className="iw-player-err-dot" title={error ?? 'Playback error'} />}
            {currentTrack.artist}
          </div>
        </div>

        <div className="iw-player-controls">
          <button
            type="button"
            className="iw-player-btn iw-player-btn-sec"
            onClick={() => { void previous(); }}
            aria-label="Previous track"
          >
            <SkipBack size={18} weight="fill" />
          </button>

          <button
            type="button"
            className="iw-player-btn iw-player-btn-main"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            disabled={loading}
          >
            {loading ? (
              <Spinner size={20} weight="bold" className="iw-spin" />
            ) : playing ? (
              <Pause size={20} weight="fill" />
            ) : (
              <Play size={20} weight="fill" />
            )}
          </button>

          <button
            type="button"
            className="iw-player-btn iw-player-btn-sec"
            onClick={() => { void next(); }}
            aria-label="Next track"
          >
            <SkipForward size={18} weight="fill" />
          </button>

          <div className="iw-player-vol">
            <SpeakerHigh size={16} weight="bold" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
            />
          </div>

          <div className="iw-player-time" aria-hidden="true">
            {formatTime(position)} / {formatTime(effectiveDuration)}
          </div>
        </div>
      </div>

      <div
        ref={progressRef}
        className="iw-player-progress"
        role="slider"
        tabIndex={0}
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={Math.max(1, Math.floor(effectiveDuration))}
        aria-valuenow={Math.floor(position)}
        onPointerDown={seekToPointer}
      >
        <div className="iw-player-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
