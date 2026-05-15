
import { playTrack, setQueue } from './tauri';
import type { Track } from './tauri';

let _lastContext: Track[] = [];

export function getLastContext(): Track[] { return _lastContext; }

export async function playWithContext(track: Track, context: Track[]): Promise<void> {
  _lastContext = context;

  const idx = context.findIndex((t) => t.id === track.id);
  const after = idx >= 0 ? context.slice(idx + 1) : [];

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
