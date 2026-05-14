import { create } from 'zustand';
import { Track } from '../lib/tauri';

export type PlaybackState = 'playing' | 'paused' | 'loading' | 'stopped' | 'ended';
export type RepeatMode = 'off' | 'one' | 'all';

interface PlayerStore {
  currentTrack: Track | null;
  playbackState: PlaybackState;
  position: number;
  duration: number;
  volume: number;
  speed: number;
  queue: Track[];
  shuffle: boolean;
  repeat: RepeatMode;
  playbackError: string | null;
  accentColor: string;
  waveform: number[];
  eqBands: number[]; // 5 values, dB each, default all 0
  /// YouTube recommendations for the currently playing track.
  /// Pre-fetched on track-change so "Up Next" shows them immediately.
  recommendations: Track[];

  setCurrentTrack: (track: Track | null) => void;
  setPlaybackState: (state: PlaybackState) => void;
  setPosition: (position: number, duration: number) => void;
  setVolume: (volume: number) => void;
  setSpeed: (speed: number) => void;
  setQueue: (queue: Track[]) => void;
  setShuffle: (v: boolean) => void;
  setRepeat: (mode: RepeatMode) => void;
  setPlaybackError: (msg: string | null) => void;
  setAccentColor: (color: string) => void;
  setWaveform: (bars: number[]) => void;
  setEqBand: (band: number, db: number) => void;
  setRecommendations: (tracks: Track[]) => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  currentTrack: null,
  playbackState: 'stopped',
  position: 0,
  duration: 0,
  volume: 0.8,
  speed: 1.0,
  queue: [],
  shuffle: false,
  repeat: 'off',
  playbackError: null,
  accentColor: 'var(--accent)',
  waveform: [],
  eqBands: [0, 0, 0, 0, 0],
  recommendations: [],

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setPlaybackState: (state) => set({ playbackState: state }),
  setPosition: (position, duration) => set({ position, duration }),
  setVolume: (volume) => set({ volume }),
  setSpeed: (speed) => set({ speed }),
  setQueue: (queue) => set({ queue }),
  setShuffle: (on) => set((state) => {
    if (on && state.queue.length > 1) {
      const shuffled = [...state.queue].sort(() => Math.random() - 0.5);
      return { shuffle: on, queue: shuffled };
    }
    return { shuffle: on };
  }),
  setRepeat: (mode) => set({ repeat: mode }),
  setPlaybackError: (msg) => set({ playbackError: msg }),
  setAccentColor: (color) => {
    set({ accentColor: color });
    // Push the live accent into a CSS variable on <html> so EVERY surface
    // (sidebar, hero, player bar, panel, banners) re-tints in unison.
    // Without this each component computes its own colour and the seams
    // between them visibly mismatch.
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      // If the value is a CSS var reference, resolve it to the current accent.
      const resolved = color.startsWith('var(') ? 'oklch(0.72 0.18 295)' : color;
      root.style.setProperty('--accent-live', resolved);
    }
  },
  setWaveform: (bars) => set({ waveform: bars }),
  setEqBand: (band, db) => set((state) => {
    const next = [...state.eqBands];
    next[band] = db;
    return { eqBands: next };
  }),
  setRecommendations: (tracks) => set({ recommendations: tracks }),
}));
