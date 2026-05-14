// Pulsing placeholder rectangle.

import type { CSSProperties } from 'react';

interface Props {
  width?: number | string;
  height?: number | string;
  rounded?: number;
  style?: CSSProperties;
}

export default function Skeleton({ width = '100%', height = 12, rounded = 4, style }: Props) {
  return (
    <>
      <style>{`
        @keyframes iw-skeleton {
          0%   { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
      `}</style>
      <div style={{
        width, height, borderRadius: rounded,
        background: `linear-gradient(90deg,
          var(--bg-overlay) 0%,
          color-mix(in oklch, var(--accent-live) 6%, var(--bg-overlay)) 40%,
          var(--bg-overlay) 80%)`,
        backgroundSize: '200px 100%',
        backgroundRepeat: 'no-repeat',
        animation: 'iw-skeleton 1.4s ease-in-out infinite',
        flexShrink: 0,
        ...style,
      }}/>
    </>
  );
}

export function TrackRowSkeleton() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px',
    }}>
      <Skeleton width={42} height={42} rounded={4}/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width="55%" height={11}/>
        <Skeleton width="35%" height={9}/>
      </div>
      <Skeleton width={32} height={9}/>
    </div>
  );
}

export function TrackListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <TrackRowSkeleton key={i}/>
      ))}
    </div>
  );
}
