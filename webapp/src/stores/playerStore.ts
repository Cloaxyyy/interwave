import { create } from 'zustand';
import { resolveStream } from '../lib/piped';
import { playerEngine, type PlayerStateName } from '../lib/playerEngine';

export interface Track {
  id: string;
  youtube_id: string;
  title: string;
  artist: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
}

interface PlayerStore {
  currentTrack: Track | null;
  state: PlayerStateName;
  position: number;
  duration: number;
  volume: number;
  queue: Track[];
  queueIndex: number;
  error: string | null;

  playTrack(track: Track): Promise<void>;
  playQueue(tracks: Track[], startIndex?: number): Promise<void>;
  togglePlay(): void;
  next(): Promise<void>;
  previous(): Promise<void>;
  seek(seconds: number): void;
  setVolume(v: number): void;
}

function updateMediaSession(track: Track | null): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  if (!track) {
    navigator.mediaSession.metadata = null;
    return;
  }
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    artwork: track.thumbnail_url
      ? [{ src: track.thumbnail_url, sizes: '512x512', type: 'image/jpeg' }]
      : [],
  });
}

export const usePlayerStore = create<PlayerStore>((set, get) => {
  // Mirror engine state into the store.
  playerEngine.subscribe((s) => {
    set({
      state: s.state,
      position: s.position,
      duration: s.duration,
      volume: s.volume,
      error: s.error ?? null,
    });
    if (s.state === 'ended') {
      // Auto-advance when a track finishes.
      void get().next();
    }
  });

  return {
    currentTrack: null,
    state: 'idle' as PlayerStateName,
    position: 0,
    duration: 0,
    volume: 0.8,
    queue: [],
    queueIndex: -1,
    error: null,

    async playTrack(track) {
      set({ currentTrack: track, state: 'loading', error: null, queue: [track], queueIndex: 0 });
      updateMediaSession(track);
      try {
        const { url } = await resolveStream(track.youtube_id);
        await playerEngine.loadAndPlay(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not load track.';
        set({ state: 'error', error: message });
      }
    },

    async playQueue(tracks, startIndex = 0) {
      if (tracks.length === 0) return;
      const idx = Math.max(0, Math.min(tracks.length - 1, startIndex));
      const track = tracks[idx];
      set({ queue: tracks, queueIndex: idx, currentTrack: track, state: 'loading', error: null });
      updateMediaSession(track);
      try {
        const { url } = await resolveStream(track.youtube_id);
        await playerEngine.loadAndPlay(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not load track.';
        set({ state: 'error', error: message });
      }
    },

    togglePlay() {
      const { state, currentTrack } = get();
      if (!currentTrack) return;
      if (state === 'playing') {
        playerEngine.pause();
      } else if (state === 'paused' || state === 'error') {
        playerEngine.resume();
      } else if (state === 'ended') {
        playerEngine.seek(0);
        playerEngine.resume();
      }
    },

    async next() {
      const { queue, queueIndex } = get();
      const nextIdx = queueIndex + 1;
      if (nextIdx >= queue.length) {
        set({ state: 'ended' });
        return;
      }
      const track = queue[nextIdx];
      set({ queueIndex: nextIdx, currentTrack: track, state: 'loading', error: null });
      updateMediaSession(track);
      try {
        const { url } = await resolveStream(track.youtube_id);
        await playerEngine.loadAndPlay(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not load track.';
        set({ state: 'error', error: message });
      }
    },

    async previous() {
      const { queue, queueIndex, position } = get();
      // Spotify-style: if >3s into the track, restart it; otherwise step back.
      if (position > 3) {
        playerEngine.seek(0);
        return;
      }
      const prevIdx = queueIndex - 1;
      if (prevIdx < 0) {
        playerEngine.seek(0);
        return;
      }
      const track = queue[prevIdx];
      set({ queueIndex: prevIdx, currentTrack: track, state: 'loading', error: null });
      updateMediaSession(track);
      try {
        const { url } = await resolveStream(track.youtube_id);
        await playerEngine.loadAndPlay(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not load track.';
        set({ state: 'error', error: message });
      }
    },

    seek(seconds) {
      playerEngine.seek(seconds);
    },

    setVolume(v) {
      playerEngine.setVolume(v);
    },
  };
});

// Wire MediaSession action handlers once. Browsers that don't support
// MediaSession just skip the registration.
if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
  try {
    navigator.mediaSession.setActionHandler('play', () => usePlayerStore.getState().togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().togglePlay());
    navigator.mediaSession.setActionHandler('nexttrack', () => { void usePlayerStore.getState().next(); });
    navigator.mediaSession.setActionHandler('previoustrack', () => { void usePlayerStore.getState().previous(); });
  } catch {
    // Some browsers throw on unsupported actions — ignore.
  }
}
