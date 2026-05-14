import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { usePlayerStore } from '../stores/playerStore';
import type { Track, SearchResult } from '../lib/tauri';
import {
  pause, resume, skipNext, skipPrev,
  setQueue, getRecommendations, playTrack, setVolume, getLibrary,
} from '../lib/tauri';
import { saveResumeState, clearResumeState } from '../lib/crashResume';
import type { PlaybackState } from '../stores/playerStore';
import { getLastContext } from '../lib/playContext';

// Convert a YouTube SearchResult into a queued Track.
function recToTrack(r: SearchResult): Track {
  return {
    id: crypto.randomUUID(),
    youtube_id: r.youtube_id,
    title: r.title,
    artist: r.artist,
    album: null,
    duration_seconds: r.duration_seconds ?? null,
    thumbnail_url: r.thumbnail_url ?? null,
    play_count: 0,
    last_played_at: null,
    liked: false,
    created_at: Math.floor(Date.now() / 1000),
    local_path: null,
  };
}

export function useTauriEvents() {
  const {
    setPlaybackState, setPosition, setCurrentTrack,
    setPlaybackError, setQueue: storeSetQueue,
    setWaveform: storeSetWaveform,
    setRecommendations,
  } = usePlayerStore();

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    // ── Recommendations cache ─────────────────────────────────────────────────
    // Pre-fetched in the background as soon as a track starts so when the
    // current track ends we can instantly autoplay the first recommendation
    // (no awkward silence). Also surfaced to the UI as "Up Next".
    let cachedRecs: Track[] = [];
    let cachedRecsForId = '';

    function prefetchRecs(track: Track) {
      cachedRecs = [];
      cachedRecsForId = track.youtube_id;
      // Clear UI immediately so the previous recs don't linger
      setRecommendations([]);
      getRecommendations(track.youtube_id)
        .then((recs) => {
          if (cachedRecsForId !== track.youtube_id) return; // track changed
          const filtered = recs
            .filter((r) => r.youtube_id !== track.youtube_id)
            .slice(0, 12)
            .map(recToTrack);
          cachedRecs = filtered;
          setRecommendations(filtered);
        })
        .catch((e) => {
          console.warn('[recommendations] fetch failed:', e);
        });
    }

    // ── playback://state ──────────────────────────────────────────────────────
    listen<{ state: string }>('playback://state', (event) => {
      const newState = event.payload.state as PlaybackState;
      setPlaybackState(newState);

      if (newState === 'ended' || newState === 'stopped') {
        // Track ended cleanly — wipe resume state so we don't suggest
        // resuming a song the user just heard end naturally.
        clearResumeState();
      }
      if (newState === 'ended') {
        handleTrackEnded().catch(console.error);
      }
    }).then((u) => cleanups.push(u));

    // ── End-of-track decision tree ────────────────────────────────────────
    // Priority:
    //   1. Repeat-one → restart same track
    //   2. Explicit queue has items → skip_next (Rust handles it)
    //   3. Repeat-all + play context → re-queue & skip
    //   4. Cached recs → autoplay (with sync fetch retry if cache is empty)
    //   5. Random library track → so the music never just dies
    async function handleTrackEnded() {
      const autoplayOn = localStorage.getItem('interwave_autoplay') !== 'false';
      const { queue, repeat, currentTrack, shuffle } = usePlayerStore.getState();

      if (repeat === 'one' && currentTrack) {
        await playTrack({
          video_id: currentTrack.youtube_id,
          title: currentTrack.title,
          artist: currentTrack.artist,
          duration_seconds: currentTrack.duration_seconds,
          thumbnail_url: currentTrack.thumbnail_url,
        });
        return;
      }
      if (queue.length > 0) { await skipNext(); return; }
      if (repeat === 'all') {
        const ctx = getLastContext();
        if (ctx.length > 0) {
          const list = shuffle ? [...ctx].sort(() => Math.random() - 0.5) : ctx;
          await setQueue(list.slice(1));
          await skipNext();
          return;
        }
      }
      if (!autoplayOn) return;

      // Try cached recs; if empty, fetch synchronously now.
      let recs = cachedRecs;
      if (recs.length === 0 && currentTrack) {
        try {
          const fresh = await getRecommendations(currentTrack.youtube_id);
          recs = fresh
            .filter((r) => r.youtube_id !== currentTrack.youtube_id)
            .slice(0, 12)
            .map(recToTrack);
        } catch (e) {
          console.warn('[autoplay] recs fetch on-end failed:', e);
        }
      }
      if (recs.length > 0) {
        cachedRecs = [];
        await setQueue(recs);
        storeSetQueue(recs);
        await skipNext();
        return;
      }

      // Last-resort fallback: pick a random track from the library so the
      // music doesn't just dead-end on the same song.
      try {
        const lib = await getLibrary();
        const candidates = lib.filter((t) => t.id !== currentTrack?.id);
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          await playTrack({
            video_id: pick.youtube_id,
            title: pick.title,
            artist: pick.artist,
            duration_seconds: pick.duration_seconds,
            thumbnail_url: pick.thumbnail_url,
          });
        }
      } catch (e) {
        console.warn('[autoplay] library fallback failed:', e);
      }
    }

    // ── playback://position ───────────────────────────────────────────────────
    // Throttle the resume-state save to once per ~3s so we're not slamming
    // localStorage on every position event (they fire every 500 ms).
    let lastSaveAt = 0;
    listen<{ position: number; duration: number }>('playback://position', (event) => {
      setPosition(event.payload.position, event.payload.duration);
      const now = Date.now();
      if (now - lastSaveAt > 3000) {
        const t = usePlayerStore.getState().currentTrack;
        if (t) saveResumeState(t, event.payload.position);
        lastSaveAt = now;
      }
    }).then((u) => cleanups.push(u));

    // ── playback://track ──────────────────────────────────────────────────────
    listen<{ track: Track }>('playback://track', (event) => {
      setCurrentTrack(event.payload.track);
      setPlaybackError(null);
      storeSetWaveform([]);
      // Pre-fetch recommendations so we have something to autoplay if the queue
      // is empty when the track ends, AND so the "Up Next" UI shows them.
      prefetchRecs(event.payload.track);
    }).then((u) => cleanups.push(u));

    // ── playback://queue ──────────────────────────────────────────────────────
    listen<{ queue: Track[] }>('playback://queue', (event) => {
      storeSetQueue(event.payload.queue);
    }).then((u) => cleanups.push(u));

    // ── playback://waveform ───────────────────────────────────────────────────
    listen<{ bars: number[] }>('playback://waveform', (event) => {
      storeSetWaveform(event.payload.bars);
    }).then((u) => cleanups.push(u));

    // ── playback://error ──────────────────────────────────────────────────────
    listen<{ message: string }>('playback://error', (event) => {
      setPlaybackError(event.payload.message);
      setPlaybackState('stopped');
    }).then((u) => cleanups.push(u));

    // ── hotkeys ───────────────────────────────────────────────────────────────
    listen<void>('hotkey://play-pause', () => {
      const state = usePlayerStore.getState().playbackState;
      if (state === 'playing') pause().catch(console.error);
      else if (state === 'paused') resume().catch(console.error);
    }).then((u) => cleanups.push(u));

    listen<void>('hotkey://skip-next', () => {
      skipNext().catch(console.error);
    }).then((u) => cleanups.push(u));

    listen<void>('hotkey://skip-prev', () => {
      skipPrev().catch(console.error);
    }).then((u) => cleanups.push(u));

    listen<void>('hotkey://volume-up', () => {
      const v = Math.min(1, usePlayerStore.getState().volume + 0.05);
      setVolume(v).catch(console.error);
      usePlayerStore.getState().setVolume(v);
    }).then((u) => cleanups.push(u));

    listen<void>('hotkey://volume-down', () => {
      const v = Math.max(0, usePlayerStore.getState().volume - 0.05);
      setVolume(v).catch(console.error);
      usePlayerStore.getState().setVolume(v);
    }).then((u) => cleanups.push(u));

    return () => {
      cleanups.forEach((u) => u());
    };
  }, [setPlaybackState, setPosition, setCurrentTrack, setPlaybackError, storeSetQueue, storeSetWaveform, setRecommendations]);
}
