import React from 'react';
import { SpeakerSimpleHigh, SpeakerSimpleX } from '@phosphor-icons/react';
import { usePlayerStore } from '../../stores/playerStore';
import { setVolume as tauriSetVolume } from '../../lib/tauri';

export default function VolumeControl() {
  const { volume, setVolume } = usePlayerStore();
  const muted = volume === 0;
  const prevVolumeRef = React.useRef(volume > 0 ? volume : 0.8);
  const [dragging, setDragging] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const barRef = React.useRef<HTMLDivElement>(null);

  const applyVolume = (clientX: number) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setVolume(fraction);
    tauriSetVolume(fraction);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    applyVolume(e.clientX);
  };

  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => applyVolume(e.clientX);
    const onUp   = (e: MouseEvent) => { applyVolume(e.clientX); setDragging(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const toggleMute = () => {
    if (muted) {
      const restore = prevVolumeRef.current;
      setVolume(restore);
      tauriSetVolume(restore);
    } else {
      prevVolumeRef.current = volume;
      setVolume(0);
      tauriSetVolume(0);
    }
  };

  const active = hovered || dragging;
  const pct = volume * 100;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        onClick={toggleMute}
        style={{
          background: 'transparent',
          border: 'none',
          color: muted ? 'var(--text-muted)' : 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          padding: 0,
          flexShrink: 0,
        }}
      >
        {muted
          ? <SpeakerSimpleX size={16} weight="duotone" />
          : <SpeakerSimpleHigh size={16} weight="duotone" />}
      </button>

      {}
      <div
        ref={barRef}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          width: 72,
          height: active ? 5 : 3,
          background: 'var(--border-default)',
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'height 120ms ease',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: muted ? 'var(--text-muted)' : 'var(--accent)',
            borderRadius: 2,
            transition: dragging ? 'none' : 'width 80ms linear',
          }}
        />
        {active && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: `${pct}%`,
            transform: 'translate(-50%, -50%)',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: muted ? 'var(--text-muted)' : 'var(--accent)',
            pointerEvents: 'none',
          }} />
        )}
      </div>
    </div>
  );
}
