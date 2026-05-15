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

    let cachedRecs: Track[] = [];
    let cachedRecsForId = '';

    function prefetchRecs(track: Track) {
      cachedRecs = [];
      cachedRecsForId = track.youtube_id;

      setRecommendations([]);
      getRecommendations(track.youtube_id)
        .then((recs) => {
          if (cachedRecsForId !== track.youtube_id) return;
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

    listen<{ state: string }>('playback://state', (event) => {
      const newState = event.payload.state as PlaybackState;
      setPlaybackState(newState);

      if (newState === 'ended' || newState === 'stopped') {

        clearResumeState();
      }
      if (newState === 'ended') {
        handleTrackEnded().catch(console.error);
      }
    }).then((u) => cleanups.push(u));

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

    listen<{ track: Track }>('playback://track', (event) => {
      setCurrentTrack(event.payload.track);
      setPlaybackError(null);
      storeSetWaveform([]);

      prefetchRecs(event.payload.track);
    }).then((u) => cleanups.push(u));

    listen<{ queue: Track[] }>('playback://queue', (event) => {
      storeSetQueue(event.payload.queue);
    }).then((u) => cleanups.push(u));

    listen<{ bars: number[] }>('playback://waveform', (event) => {
      storeSetWaveform(event.payload.bars);
    }).then((u) => cleanups.push(u));

    listen<{ message: string }>('playback://error', (event) => {
      setPlaybackError(event.payload.message);
      setPlaybackState('stopped');
    }).then((u) => cleanups.push(u));

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
