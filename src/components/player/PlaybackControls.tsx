import { useState } from 'react';
import {
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Shuffle,
  Repeat,
} from '@phosphor-icons/react';
import { usePlayerStore, RepeatMode } from '../../stores/playerStore';
import { pause as tauriPause, resume as tauriResume, skipNext, skipPrev, setShuffleCmd, setRepeatCmd, setQueue, setSpeed } from '../../lib/tauri';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface PlaybackControlsProps {

  variant?: 'full' | 'compact';
}

interface IconButtonProps {
  icon: React.ReactNode;
  action: () => void;
  active?: boolean;
  title?: string;
}

function IconButton({ icon, action, active = false, title }: IconButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={action}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'transparent',
        border: 'none',
        color: active
          ? 'var(--accent)'
          : hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        padding: 4,
        borderRadius: 4,
        transition: 'color 150ms',
      }}
    >
      {icon}
    </button>
  );
}

export default function PlaybackControls({ variant = 'full' }: PlaybackControlsProps) {
  const { playbackState } = usePlayerStore();
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat  = usePlayerStore((s) => s.repeat);
  const speed   = usePlayerStore((s) => s.speed);
  const setShuffle  = usePlayerStore((s) => s.setShuffle);
  const setRepeat   = usePlayerStore((s) => s.setRepeat);
  const setSpeedStore = usePlayerStore((s) => s.setSpeed);
  const [speedHovered, setSpeedHovered] = useState(false);

  const isPlaying = playbackState === 'playing';
  const isLoading = playbackState === 'loading';

  const handlePlayPause = () => {
    if (isPlaying) {
      tauriPause();
    } else if (playbackState === 'paused') {
      tauriResume();
    }
  };

  const handleShuffle = async () => {
    const next = !shuffle;
    setShuffle(next);
    await setShuffleCmd(next);

    if (next) {
      const newQueue = usePlayerStore.getState().queue;
      if (newQueue.length > 0) {
        await setQueue(newQueue);
      }
    }
  };

  const handleRepeat = async () => {
    const next: RepeatMode = repeat === 'off' ? 'one' : repeat === 'one' ? 'all' : 'off';
    setRepeat(next);
    await setRepeatCmd(next);
  };

  const handleSpeedClick = async () => {
    const idx = SPEED_OPTIONS.indexOf(speed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setSpeedStore(next);
    await setSpeed(next);
  };

  const isActive = playbackState === 'playing' || playbackState === 'paused';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: variant === 'full' ? 8 : 4 }}>
      {variant === 'full' && <IconButton icon={<Shuffle size={16} />} action={() => { handleShuffle().catch(console.error); }} active={shuffle} title="Shuffle" />}
      {variant === 'full' && <IconButton icon={<SkipBack size={20} weight="fill" />} action={() => { skipPrev().catch(console.error); }} title="Previous" />}

      {}
      <button
        onClick={handlePlayPause}
        disabled={isLoading || playbackState === 'stopped'}
        title={isPlaying ? 'Pause' : 'Play'}
        style={{
          width: variant === 'full' ? 40 : 32,
          height: variant === 'full' ? 40 : 32,
          borderRadius: '50%',
          background: isLoading ? 'var(--accent-dim)' : 'var(--accent)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: (isLoading || playbackState === 'stopped') ? 'default' : 'pointer',
          opacity: playbackState === 'stopped' ? 0.4 : 1,
          transition: 'opacity 200ms, background 200ms',
        }}
      >
        {isPlaying
          ? <Pause size={variant === 'full' ? 18 : 14} weight="fill" color="#000" />
          : <Play size={variant === 'full' ? 18 : 14} weight="fill" color="#000" style={{ marginLeft: 2 }} />}
      </button>

      {variant === 'full' && <IconButton icon={<SkipForward size={20} weight="fill" />} action={() => { skipNext().catch(console.error); }} title="Next" />}
      {variant === 'full' && <IconButton icon={<Repeat size={16} />} action={() => { handleRepeat().catch(console.error); }} active={repeat !== 'off'} title={repeat === 'off' ? 'Repeat: Off' : repeat === 'one' ? 'Repeat: One' : 'Repeat: All'} />}
      {variant === 'full' && isActive && (
        <button
          onClick={() => { handleSpeedClick().catch(console.error); }}
          title={`Playback speed: ${speed}×`}
          onMouseEnter={() => setSpeedHovered(true)}
          onMouseLeave={() => setSpeedHovered(false)}
          style={{
            background: speed !== 1 ? 'var(--accent-dim, rgba(255,255,255,0.12))' : 'transparent',
            border: '1px solid',
            borderColor: speed !== 1 ? 'var(--accent)' : speedHovered ? 'var(--text-secondary)' : 'transparent',
            color: speed !== 1 ? 'var(--accent)' : speedHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.02em',
            lineHeight: 1,
            minWidth: 32,
            transition: 'color 150ms, border-color 150ms, background 150ms',
          }}
        >
          {speed === 1 ? '1×' : `${speed}×`}
        </button>
      )}
    </div>
  );
}
