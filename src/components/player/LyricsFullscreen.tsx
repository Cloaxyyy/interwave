
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MicrophoneStage } from '@phosphor-icons/react';
import { useUiStore } from '../../stores/uiStore';
import { usePlayerStore } from '../../stores/playerStore';
import { getLyrics, seek, type LyricsResult } from '../../lib/tauri';
import { useState } from 'react';

export default function LyricsFullscreen() {
  const open = useUiStore((s) => s.lyricsFullscreen);
  const setOpen = useUiStore((s) => s.setLyricsFullscreen);
  const { currentTrack, position, accentColor } = usePlayerStore();

  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const activeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!open || !currentTrack) return;
    let cancelled = false;
    setLoading(true);
    setLyrics(null);
    getLyrics(currentTrack.title, currentTrack.artist, currentTrack.duration_seconds)
      .then((r) => { if (!cancelled) setLyrics(r); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, currentTrack?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const synced = lyrics?.has_synced ? lyrics.synced : null;
  let activeIdx = 0;
  if (synced) {
    const ms = position * 1000;
    for (let i = 0; i < synced.length; i++) {
      if (synced[i].time_ms <= ms) activeIdx = i;
    }
  }
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIdx]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed',

            top: 0, left: 0, right: 0,
            bottom: 92,
            zIndex: 9500,
            background: `
              radial-gradient(ellipse at top, color-mix(in oklch, ${accentColor} 30%, transparent) 0%, transparent 55%),
              radial-gradient(ellipse at bottom, color-mix(in oklch, ${accentColor} 14%, transparent) 0%, transparent 50%),
              rgba(6, 4, 14, 0.94)
            `,
            backdropFilter: 'blur(48px) saturate(160%)',
            WebkitBackdropFilter: 'blur(48px) saturate(160%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '32px 56px 0',
            overflow: 'hidden',
          }}
        >
          {}
          <div data-tauri-drag-region style={{
            width: '100%', maxWidth: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 20,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, minWidth: 0,
            }}>
              {currentTrack?.thumbnail_url && (
                <img src={currentTrack.thumbnail_url} alt="" draggable={false}
                  style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover',
                           boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}/>
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700,
                  color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{currentTrack?.title ?? 'Nothing playing'}</p>
                <p style={{
                  fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-secondary)',
                  marginTop: 2,
                }}>{currentTrack?.artist ?? '—'}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.10em',
                textTransform: 'uppercase', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <MicrophoneStage size={13} weight="fill" />
                Lyrics view · Esc to close
              </span>
              <button
                onClick={() => setOpen(false)}
                title="Close (Esc)"
                style={{
                  background: 'var(--bg-overlay)', border: '1px solid var(--border-default)',
                  borderRadius: '50%', width: 32, height: 32,
                  display: 'grid', placeItems: 'center',
                  color: 'var(--text-primary)', cursor: 'pointer',
                  transition: 'background 160ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-overlay)'; }}
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          </div>

          {}
          <div
            className="iw-lyrics-scroll"
            style={{
              flex: 1, width: '100%', maxWidth: 1000, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              paddingTop: '22vh', paddingBottom: '24vh',
            }}
          >
            <style>{`
              /* Hidden scrollbar but still scrollable (mouse wheel still works) */
              .iw-lyrics-scroll { scrollbar-width: none; -ms-overflow-style: none; }
              .iw-lyrics-scroll::-webkit-scrollbar { display: none; }
            `}</style>

            {loading && (
              <p style={{
                color: 'var(--text-muted)', fontSize: 16, fontFamily: 'var(--sans)',
              }}>Loading lyrics…</p>
            )}
            {!loading && !lyrics && (
              <p style={{
                color: 'var(--text-muted)', fontSize: 16, fontFamily: 'var(--sans)',
              }}>No lyrics found for this track.</p>
            )}
            {!loading && synced && synced.map((line, i) => {
              const isActive = i === activeIdx;
              const dist = Math.abs(i - activeIdx);
              const opacity = isActive ? 1 : Math.max(0.14, 1 - dist * 0.16);

              if (isActive && line.text) {
                const lineStartMs = line.time_ms;
                const lineEndMs = synced[i + 1]?.time_ms ?? lineStartMs + 4000;
                const lineDur = Math.max(1, lineEndMs - lineStartMs);
                const elapsed = Math.max(0, Math.min(lineDur, position * 1000 - lineStartMs));
                const progress = elapsed / lineDur;

                const words = line.text.split(/(\s+)/);
                const charLengths = words.map((w) => Math.max(1, w.length));
                const totalChars = charLengths.reduce((a, b) => a + b, 0);
                let cum = 0;
                const wordStarts = charLengths.map((len) => {
                  const start = cum / totalChars;
                  cum += len;
                  return start;
                });

                return (
                  <p
                    key={i}
                    ref={activeRef}
                    onClick={() => seek(line.time_ms / 1000).catch(console.error)}
                    style={{
                      fontFamily: 'var(--serif)',
                      fontSize: 'clamp(40px, 5vw, 64px)',
                      fontWeight: 500,
                      letterSpacing: '-0.018em',
                      lineHeight: 1.18,
                      margin: '18px 0',
                      padding: '6px 24px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'opacity 320ms cubic-bezier(0.4,0,0.2,1)',
                      maxWidth: '100%',
                      opacity: 1,
                    }}
                  >
                    {words.map((w, wi) => {
                      const isSpace = /^\s+$/.test(w);
                      if (isSpace) return <span key={wi}>{w}</span>;
                      const start = wordStarts[wi];

                      const leadIn = 0.05;
                      const wordProgress = Math.max(0, Math.min(1, (progress - start) / leadIn));
                      const reached = progress >= start;
                      return (
                        <span
                          key={wi}
                          style={{
                            color: reached
                              ? `color-mix(in oklch, var(--text-primary) ${Math.round(wordProgress * 100)}%, var(--text-secondary))`
                              : 'var(--text-secondary)',
                            textShadow: reached && wordProgress > 0.6
                              ? `0 0 28px color-mix(in oklch, ${accentColor} 55%, transparent)`
                              : 'none',
                            transition: 'color 220ms ease, text-shadow 320ms ease',
                            opacity: reached ? 1 : 0.55,
                          }}
                        >
                          {w}
                        </span>
                      );
                    })}
                  </p>
                );
              }

              return (
                <p
                  key={i}
                  onClick={() => seek(line.time_ms / 1000).catch(console.error)}
                  style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 'clamp(26px, 3vw, 38px)',
                    fontWeight: 400,
                    color: 'var(--text-secondary)',
                    opacity,
                    letterSpacing: '-0.018em',
                    lineHeight: 1.18,
                    margin: '18px 0',
                    padding: '6px 24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 320ms cubic-bezier(0.4,0,0.2,1)',
                    maxWidth: '100%',
                  }}
                >
                  {line.text || '♪'}
                </p>
              );
            })}
            {!loading && !synced && lyrics?.plain && lyrics.plain.split('\n').map((line, i) => (
              <p key={i} style={{
                fontFamily: 'var(--serif)', fontSize: 'clamp(22px, 2.5vw, 32px)',
                color: 'var(--text-secondary)',
                margin: '12px 0', textAlign: 'center', letterSpacing: '-0.012em',
                lineHeight: 1.4,
              }}>
                {line || ' '}
              </p>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
