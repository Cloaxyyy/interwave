// Thin wrapper around a single HTMLAudioElement. Emits state snapshots to
// subscribers (the Zustand store mirrors these into React state).
//
// Intentionally simple — no Web Audio graph; we can layer EQ in later.

export type PlayerStateName =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export interface PlayerState {
  state: PlayerStateName;
  position: number;
  duration: number;
  volume: number;
  error?: string;
}

export type PlayerListener = (state: PlayerState) => void;

const VOL_KEY = 'iw-vol';
const DEFAULT_VOLUME = 0.8;
const TIMEUPDATE_THROTTLE_MS = 250;

function readStoredVolume(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_VOLUME;
  const raw = localStorage.getItem(VOL_KEY);
  if (raw == null) return DEFAULT_VOLUME;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, n));
}

function mediaErrorMessage(code: number | undefined): string {
  switch (code) {
    case 1: return 'Playback aborted.';
    case 2: return 'Network error while loading audio.';
    case 3: return 'Audio decoding failed.';
    case 4: return 'Audio format not supported.';
    default: return 'Unknown playback error.';
  }
}

class PlayerEngine {
  private audio: HTMLAudioElement | null = null;
  private listeners = new Set<PlayerListener>();
  private state: PlayerStateName = 'idle';
  private error: string | undefined;
  private lastTimeUpdate = 0;
  private destroyed = false;

  constructor() {
    if (typeof window === 'undefined') return;
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';
    audio.volume = readStoredVolume();
    this.audio = audio;
    this.attach(audio);
  }

  private attach(audio: HTMLAudioElement): void {
    audio.addEventListener('loadstart', () => {
      this.setState('loading');
    });
    audio.addEventListener('loadedmetadata', () => this.emit());
    audio.addEventListener('playing', () => {
      this.error = undefined;
      this.setState('playing');
    });
    audio.addEventListener('pause', () => {
      // 'ended' also fires pause; don't clobber that terminal state.
      if (audio.ended) return;
      if (this.state !== 'error') this.setState('paused');
    });
    audio.addEventListener('ended', () => this.setState('ended'));
    audio.addEventListener('error', () => {
      this.error = mediaErrorMessage(audio.error?.code);
      this.setState('error');
    });
    audio.addEventListener('timeupdate', () => {
      const now = performance.now();
      if (now - this.lastTimeUpdate < TIMEUPDATE_THROTTLE_MS) return;
      this.lastTimeUpdate = now;
      this.emit();
    });
    audio.addEventListener('volumechange', () => this.emit());
  }

  private setState(next: PlayerStateName): void {
    this.state = next;
    if (next !== 'error') this.error = undefined;
    this.emit();
  }

  private snapshot(): PlayerState {
    const a = this.audio;
    return {
      state: this.state,
      position: a?.currentTime ?? 0,
      duration: Number.isFinite(a?.duration) ? (a?.duration ?? 0) : 0,
      volume: a?.volume ?? DEFAULT_VOLUME,
      error: this.error,
    };
  }

  private emit(): void {
    if (this.destroyed) return;
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }

  async loadAndPlay(streamUrl: string): Promise<void> {
    const audio = this.audio;
    if (!audio) return;
    this.error = undefined;
    this.setState('loading');
    audio.src = streamUrl;
    try {
      await audio.play();
    } catch (err) {
      // Autoplay rejection on mobile / blocked tabs — surface as paused with
      // a friendly nudge. The user can tap play to retry.
      this.error =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'User interaction required to play.'
          : err instanceof Error
            ? err.message
            : 'Could not start playback.';
      this.state = 'paused';
      this.emit();
    }
  }

  pause(): void {
    this.audio?.pause();
  }

  resume(): void {
    const audio = this.audio;
    if (!audio || !audio.src) return;
    void audio.play().catch((err: unknown) => {
      this.error =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'User interaction required to play.'
          : 'Could not resume playback.';
      this.state = 'paused';
      this.emit();
    });
  }

  seek(seconds: number): void {
    const audio = this.audio;
    if (!audio) return;
    const d = Number.isFinite(audio.duration) ? audio.duration : 0;
    const clamped = Math.max(0, Math.min(d || seconds, seconds));
    audio.currentTime = clamped;
    this.emit();
  }

  setVolume(volume: number): void {
    const audio = this.audio;
    if (!audio) return;
    const v = Math.min(1, Math.max(0, volume));
    audio.volume = v;
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(VOL_KEY, String(v)); } catch { /* ignore quota */ }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
    const audio = this.audio;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    this.audio = null;
  }

  subscribe(listener: PlayerListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const playerEngine = new PlayerEngine();
