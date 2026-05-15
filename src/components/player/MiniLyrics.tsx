
import { useEffect, useRef, useState } from 'react';
import { MicrophoneStage } from '@phosphor-icons/react';
import { usePlayerStore } from '../../stores/playerStore';
import { useUiStore } from '../../stores/uiStore';
import { getLyrics, seek, type LyricsResult } from '../../lib/tauri';

export default function MiniLyrics() {
  const { currentTrack, position } = usePlayerStore();
  const setLyricsFullscreen = useUiStore((s) => s.setLyricsFullscreen);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!currentTrack) { setLyrics(null); return; }
    cancelledRef.current = false;
    setLoading(true);
    setLyrics(null);
    getLyrics(currentTrack.title, currentTrack.artist, currentTrack.duration_seconds)
      .then((r) => { if (!cancelledRef.current) setLyrics(r); })
      .catch(() => {})
      .finally(() => { if (!cancelledRef.current) setLoading(false); });
    return () => { cancelledRef.current = true; };
  }, [currentTrack?.id]);

  if (!currentTrack) return null;

  if (loading) {
    return (
      <Shell>
        <p style={{
          fontFamily: 'var(--sans)', fontSize: 12,
          color: 'var(--text-muted)', textAlign: 'center', padding: 14,
        }}>Loading lyrics…</p>
      </Shell>
    );
  }

  if (!lyrics?.has_synced) {
    if (lyrics?.plain) {

      const lines = lyrics.plain.split('\n').filter((l) => l.trim()).slice(0, 3);
      return (
        <Shell onClick={() => setLyricsFullscreen(true)} interactive>
          <div style={{
            position: 'absolute', top: 6, right: 8,
            fontFamily: 'var(--mono)', fontSize: 9,
            color: 'var(--text-muted)', letterSpacing: '0.1em',
            display: 'flex', alignItems: 'center', gap: 4,
            textTransform: 'uppercase',
          }}>
            <MicrophoneStage size={10} weight="fill"/>
            Lyrics
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 4, padding: '14px 12px 12px',
            textAlign: 'center', minHeight: 90, justifyContent: 'center',
          }}>
            {lines.map((line, i) => (
              <p key={i} style={{
                fontFamily: 'var(--sans)',
                fontSize: i === 0 ? 13 : 11,
                fontWeight: i === 0 ? 600 : 400,
                color: i === 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                opacity: i === 0 ? 1 : 0.7,
                lineHeight: 1.3, margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}>{line}</p>
            ))}
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)',
              marginTop: 4, letterSpacing: '0.05em',
            }}>Tap to open full lyrics →</span>
          </div>
        </Shell>
      );
    }
    return (
      <Shell onClick={() => setLyricsFullscreen(true)} interactive>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          padding: '14px 12px', textAlign: 'center', minHeight: 90, justifyContent: 'center',
        }}>
          <MicrophoneStage size={20} weight="duotone" color="var(--text-muted)" />
          <p style={{
            fontFamily: 'var(--sans)', fontSize: 11.5,
            color: 'var(--text-secondary)', margin: 0,
          }}>
            No synced lyrics found
          </p>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)',
            letterSpacing: '0.05em',
          }}>Tap to retry / open fullscreen →</span>
        </div>
      </Shell>
    );
  }

  const synced = lyrics.synced;
  const posMs = position * 1000;
  let activeIdx = 0;
  for (let i = 0; i < synced.length; i++) {
    if (synced[i].time_ms <= posMs) activeIdx = i;
  }

  const prev = synced[activeIdx - 1];
  const cur  = synced[activeIdx];
  const next = synced[activeIdx + 1];

  const renderActive = () => {
    if (!cur) return null;
    return (
      <span style={{
        color: 'var(--text-primary)',
        transition: 'color 240ms ease',
      }}>
        {cur.text}
      </span>
    );
  };

  return (
    <Shell onClick={() => setLyricsFullscreen(true)} interactive>
      <div style={{
        position: 'absolute', top: 6, right: 8,
        fontFamily: 'var(--mono)', fontSize: 9,
        color: 'var(--text-muted)', letterSpacing: '0.1em',
        display: 'flex', alignItems: 'center', gap: 4,
        textTransform: 'uppercase',
      }}>
        <MicrophoneStage size={10} weight="fill"/>
        Lyrics
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 4, padding: '14px 12px 12px',
        textAlign: 'center', minHeight: 90,
        justifyContent: 'center',
      }}>
        <p style={{
          fontFamily: 'var(--sans)', fontSize: 11,
          color: 'var(--text-muted)', opacity: 0.7,
          minHeight: 14, lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}>
          {prev?.text ?? '…'}
        </p>
        <p style={{
          fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700,
          lineHeight: 1.3, margin: 0, padding: '2px 4px',
          minHeight: 18, maxWidth: '100%',
        }}>
          {renderActive() ?? '♪'}
        </p>
        <p style={{
          fontFamily: 'var(--sans)', fontSize: 11,
          color: 'var(--text-muted)', opacity: 0.7,
          minHeight: 14, lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}>
          {next?.text ?? ''}
        </p>
      </div>
    </Shell>
  );
}

function Shell({
  children, onClick, interactive = false,
}: { children: React.ReactNode; onClick?: () => void; interactive?: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        width: '100%', flexShrink: 0,
        background: 'color-mix(in oklch, var(--accent-live) 6%, var(--bg-overlay))',
        border: '1px solid var(--seam)',
        borderRadius: 12,
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        transition: 'background 200ms ease, border-color 200ms ease',
      }}
      onMouseEnter={interactive ? (e) => {
        e.currentTarget.style.background = 'color-mix(in oklch, var(--accent-live) 12%, var(--bg-overlay))';
      } : undefined}
      onMouseLeave={interactive ? (e) => {
        e.currentTarget.style.background = 'color-mix(in oklch, var(--accent-live) 6%, var(--bg-overlay))';
      } : undefined}
    >
      {}
      {children}
    </div>
  );
}

export const lyricSeek = (ms: number) => seek(ms / 1000).catch(console.error);
