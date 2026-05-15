import { useEffect, useState } from 'react';
import { MagnifyingGlass, MusicNotes, SlidersHorizontal, ArrowRight, X } from '@phosphor-icons/react';

const KEY = 'iw_onboarded_v1';

interface Step {
  Icon: typeof MagnifyingGlass;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    Icon: MusicNotes,
    title: 'Welcome to Interwave',
    body: 'A free, lightweight music player that streams from YouTube. Anything you can find on YouTube, you can play here — no ads, no algorithm noise.',
  },
  {
    Icon: MagnifyingGlass,
    title: 'Search and build your library',
    body: 'Press ⌘K (or Ctrl+K) to jump anywhere. Use Search to find a track, Library to revisit what you\'ve played, and Playlists to organize.',
  },
  {
    Icon: SlidersHorizontal,
    title: 'Make it yours',
    body: 'Open Settings to dial in the equalizer, set crossfade duration, customize global hotkeys, and toggle features like lyrics, sleep timer, and Discord presence. Press ? anywhere for the keyboard shortcuts.',
  },
];

export default function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(KEY);
      if (!seen) setOpen(true);
    } catch {}
  }, []);

  const close = () => {
    try { localStorage.setItem(KEY, '1'); } catch {}
    setOpen(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else close();
  };

  if (!open) return null;
  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        style={{
          width: 'min(480px, 100%)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {}
        <button
          onClick={close}
          aria-label="Skip onboarding"
          style={{
            position: 'absolute', top: 24, right: 24,
            background: 'transparent', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', padding: 6, display: 'flex',
          }}
          title="Skip"
        >
          <X size={16} weight="bold"/>
        </button>

        {}
        <div style={{
          height: 160,
          background: 'linear-gradient(135deg, oklch(0.42 0.18 130), oklch(0.28 0.12 165))',
          display: 'grid', placeItems: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 50% 60%, rgba(255,255,255,0.15), transparent 60%)',
          }}/>
          <cur.Icon size={72} weight="duotone" color="white" style={{ opacity: 0.95, position: 'relative' }}/>
        </div>

        {}
        <div style={{ padding: '28px 32px 24px' }}>
          <p style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)',
            letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 style={{
            fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400,
            letterSpacing: '-0.02em', color: 'var(--text-primary)',
            lineHeight: 1.15, marginBottom: 12,
          }}>
            {cur.title}
          </h2>
          <p style={{
            fontFamily: 'var(--sans)', fontSize: 13.5,
            color: 'var(--text-secondary)', lineHeight: 1.6,
            marginBottom: 24,
          }}>
            {cur.body}
          </p>

          {}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: i <= step ? 'var(--accent)' : 'var(--border-default)',
                  transition: 'background 240ms',
                }}
              />
            ))}
          </div>

          {}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <button
              onClick={close}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--text-muted)',
                fontFamily: 'var(--sans)', fontSize: 12,
                cursor: 'pointer', padding: '8px 4px',
              }}
            >
              Skip
            </button>
            <button
              onClick={next}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--accent)', color: '#000',
                border: 'none', borderRadius: 8,
                padding: '10px 18px',
                fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
                transition: 'transform 120ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {isLast ? 'Start listening' : 'Next'}
              <ArrowRight size={13} weight="bold"/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
