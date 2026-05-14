import { usePlayerStore } from '../../stores/playerStore';

const STYLE_ID = 'wave-soundwave-keyframes';

function ensureKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes soundwave-bar {
      0%, 100% { transform: scaleY(0.3); }
      50%       { transform: scaleY(1.0); }
    }
  `;
  document.head.appendChild(style);
}

// Call at module scope — runs once on import, before any component mounts
ensureKeyframes();

export default function SoundWaveIcon({ size = 14 }: { size?: number }) {
  const { playbackState } = usePlayerStore();
  const playing = playbackState === 'playing';

  const barStyle = (delay: string): React.CSSProperties => ({
    width: Math.round(size / 4),
    height: size,
    background: 'var(--accent)',
    borderRadius: 2,
    transformOrigin: 'bottom',
    animation: playing
      ? `soundwave-bar 0.8s ease-in-out ${delay} infinite`
      : 'none',
    transform: playing ? undefined : 'scaleY(0.3)',
    transition: 'transform 200ms',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: Math.round(size / 6), height: size }}>
      <div style={barStyle('0s')} />
      <div style={barStyle('0.2s')} />
      <div style={barStyle('0.4s')} />
    </div>
  );
}
