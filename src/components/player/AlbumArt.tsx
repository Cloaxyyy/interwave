import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MusicNote } from '@phosphor-icons/react';
import { usePlayerStore } from '../../stores/playerStore';
import { extractAccentColor } from '../../lib/colorExtract';

interface AlbumArtProps {
  size?: number;
}

export default function AlbumArt({ size = 220 }: AlbumArtProps) {
  const { currentTrack, playbackState } = usePlayerStore();
  const url = currentTrack?.thumbnail_url ?? null;
  const isPlaying = playbackState === 'playing';

  const rotationRef = useRef<number>(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const rafRef = useRef<number | null>(null);
  const isPlayingRef = useRef<boolean>(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!url) return;

    const animate = () => {
      if (isPlayingRef.current) {
        rotationRef.current += 0.03;
        if (imgRef.current) {
          imgRef.current.style.transform = `rotate(${rotationRef.current}deg)`;
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [url]);

  useEffect(() => {
    rotationRef.current = 0;
    if (imgRef.current) {
      imgRef.current.style.transform = 'rotate(0deg)';
    }
  }, [url]);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, overflow: 'hidden' }}>
      {}
      {url && (
        <div
          style={{
            position: 'absolute',
            inset: '-16px',
            backgroundImage: `url(${url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(32px) saturate(1.4)',
            opacity: 0.25,
            borderRadius: 8,
            zIndex: 0,
          }}
        />
      )}

      {}
      <AnimatePresence mode="wait">
        <motion.div
          key={url ?? 'placeholder'}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'relative',
            zIndex: 1,
            width: size,
            height: size,
            borderRadius: 10,
            overflow: 'hidden',
            background: url ? 'transparent' : 'var(--bg-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {url ? (
            <img
              ref={imgRef}
              src={url}
              alt={currentTrack?.title ?? 'Album art'}
              crossOrigin="anonymous"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                transition: 'none',
                transformOrigin: 'center center',
              }}
              draggable={false}
              onLoad={() => {

                const pinned = (() => {
                  try { return localStorage.getItem('iw_accent_override') || ''; } catch { return ''; }
                })();
                if (pinned) {
                  usePlayerStore.getState().setAccentColor(pinned);
                  return;
                }
                extractAccentColor(url)
                  .then((c) => usePlayerStore.getState().setAccentColor(c))
                  .catch(() => usePlayerStore.getState().setAccentColor('var(--accent)'));
              }}
              onError={() => usePlayerStore.getState().setAccentColor('var(--accent)')}
            />
          ) : (
            <MusicNote size={48} weight="duotone" color="var(--text-muted)" />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
