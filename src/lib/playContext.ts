/**
 * Play a track from a list and set the rest of the list as the queue.
 * The `allTracks` list is stored so repeat-all can refill the queue.
 */
import { playTrack, setQueue } from './tauri';
import type { Track } from './tauri';

let _lastContext: Track[] = [];

export function getLastContext(): Track[] { return _lastContext; }

export async function playWithContext(track: Track, context: Track[]): Promise<void> {
  _lastContext = context;
  // Find the clicked track, queue everything after it
  const idx = context.findIndex((t) => t.id === track.id);
  const after = idx >= 0 ? context.slice(idx + 1) : [];

  // Fire play + set_queue in parallel — play_track starts immediately,
  // set_queue just replaces the backend queue atomically (no round-trips per track)
  await Promise.all([
    playTrack({
      video_id: track.youtube_id,
      title: track.title,
      artist: track.artist,
      duration_seconds: track.duration_seconds,
      thumbnail_url: track.thumbnail_url,
    }),
    setQueue(after),
  ]);
}
