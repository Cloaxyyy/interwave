import { invoke } from '@tauri-apps/api/core';

// ── Shared types (snake_case matches Rust serde output) ───────────────────────

export interface Track {
  id: string;
  youtube_id: string;
  title: string;
  artist: string;
  album: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  play_count: number;
  last_played_at: number | null;
  liked: boolean;
  created_at: number;
  local_path: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  spotify_id: string | null;
}

export interface Settings {
  volume: number;
  crossfade_seconds: number;
  performance_mode: boolean;
  global_hotkeys: boolean;
}

export interface SearchResult {
  youtube_id: string;
  title: string;
  artist: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
}

// ── Playback ───────────────────────────────────────────────────────────────────
// NOTE: Tauri 2 maps JS camelCase → Rust snake_case for TOP-LEVEL command params.
// Nested struct fields (Track, Settings) are deserialized by serde as snake_case.

export interface PlayTrackParams {
  video_id: string;
  title: string;
  artist: string;
  album?: string | null;
  duration_seconds?: number | null;
  thumbnail_url?: string | null;
}

export const playTrack = (p: PlayTrackParams) =>
  invoke<void>('play_track', {
    videoId: p.video_id,
    title: p.title,
    artist: p.artist,
    album: p.album ?? null,
    durationSeconds: p.duration_seconds ?? null,
    thumbnailUrl: p.thumbnail_url ?? null,
  });

export const pause = () => invoke<void>('pause');
export const resume = () => invoke<void>('resume');
export const setVolume = (level: number) => invoke<void>('set_volume', { level });
export const getQueue = () => invoke<Track[]>('get_queue');
export const addToQueue = (track: Track) => invoke<void>('add_to_queue', { track });
export const clearQueue = () => invoke<void>('clear_queue');
export const setQueue = (tracks: Track[]) => invoke<void>('set_queue', { tracks });
export const skipNext = () => invoke<void>('skip_next');
export const skipPrev = () => invoke<void>('skip_prev');
export const seek = (positionSecs: number) =>
  invoke<void>('seek', { positionSecs });

// ── Library ────────────────────────────────────────────────────────────────────

export const getLibrary = () => invoke<Track[]>('get_library');
export const likeTrack = (trackId: string) => invoke<void>('like_track', { trackId });
export const unlikeTrack = (trackId: string) => invoke<void>('unlike_track', { trackId });
export const getLikedTracks = () => invoke<Track[]>('get_liked_tracks');
export const deleteTrack = (trackId: string) => invoke<void>('delete_track', { trackId });

// ── Playlists ──────────────────────────────────────────────────────────────────

export const getAllPlaylists = () => invoke<Playlist[]>('get_all_playlists');
export const createPlaylist = (name: string) =>
  invoke<Playlist>('create_playlist', { name });
export const getPlaylist = (id: string) => invoke<Track[]>('get_playlist', { id });
export const addTrackToPlaylist = (playlistId: string, track: Track) =>
  invoke<void>('add_track_to_playlist', { playlistId, track });
export const removeTrackFromPlaylist = (playlistId: string, trackId: string) =>
  invoke<void>('remove_track_from_playlist', { playlistId, trackId });
export const deletePlaylist = (playlistId: string) =>
  invoke<void>('delete_playlist', { playlistId });
export const renamePlaylist = (playlistId: string, name: string) =>
  invoke<void>('rename_playlist', { playlistId, name });

// ── Settings ───────────────────────────────────────────────────────────────────

export const getSettings = () => invoke<Settings>('get_settings');
export const updateSettings = (settingsVal: Settings) =>
  invoke<void>('update_settings', { settingsVal });

// ── Search ─────────────────────────────────────────────────────────────────────

export const searchYoutube = (query: string) =>
  invoke<SearchResult[]>('search_youtube', { query });
export const getSearchHistory = () => invoke<string[]>('get_search_history');
export const clearSearchHistory = () => invoke<void>('clear_search_history');

// ── Save track from search (for like/playlist without playing first) ───────────

export const saveTrackFromSearch = (
  youtubeId: string,
  title: string,
  artist: string,
  durationSeconds: number | null,
  thumbnailUrl: string | null,
) =>
  invoke<Track>('save_track_from_search', {
    youtubeId,
    title,
    artist,
    durationSeconds,
    thumbnailUrl,
  });

// ── Spotify file import ────────────────────────────────────────────────────────

export interface ImportProgressEvent {
  current: number;
  total: number;
  track_name: string;
  status: 'matching' | 'imported' | 'failed';
}

export interface ImportCompleteEvent {
  imported: number;
  failed: number;
  /** True if Spotify returned fewer tracks than the playlist actually has
   *  (the public embed page truncates large playlists to ~100). */
  truncated?: boolean;
  /** Spotify's reported total track count, when available. 0 = unknown. */
  spotify_total?: number;
  /** When re-importing the same Spotify playlist, how many tracks were already
   *  in the local playlist and got skipped (no duplicates). */
  already_present?: number;
}

export const spotifyImportFile = (filePath: string) =>
  invoke<void>('spotify_import_file', { filePath });

export const importSpotifyUrl = (url: string) =>
  invoke<void>('import_spotify_url', { url });

export const setShuffleCmd = (enabled: boolean) =>
  invoke<void>('set_shuffle', { enabled });

export const setRepeatCmd = (mode: 'off' | 'one' | 'all') =>
  invoke<void>('set_repeat', { mode });

export const setSpeed = (speed: number) => invoke<void>('set_speed', { speed });
export const setCrossfade = (secs: number) => invoke<void>('set_crossfade', { secs });
export const getCrossfade = () => invoke<number>('get_crossfade');

// ── Stats ──────────────────────────────────────────────────────────────────────

export interface ListeningStats {
  total_tracks: number;
  total_liked: number;
  total_playlists: number;
  hours_this_month: number;
}

export interface TopArtist {
  name: string;
  play_count: number;
}

export interface RecentTrack {
  track_id: string;
  youtube_id: string;
  title: string;
  artist: string;
  thumbnail_url: string | null;
  played_at: number;
}

export const getStats = () => invoke<ListeningStats>('get_stats');
export const getTopArtists = () => invoke<TopArtist[]>('get_top_artists');
export const getRecentlyPlayed = () => invoke<RecentTrack[]>('get_recently_played');

// ── Cloud sync helpers ─────────────────────────────────────────────────────────

export const importCloudTracks = (cloudTracks: Track[]) =>
  invoke<number>('import_cloud_tracks', { cloudTracks });

export const importCloudPlaylists = (cloudPlaylists: Playlist[]) =>
  invoke<number>('import_cloud_playlists', { cloudPlaylists });

export const importCloudPlaylistTrack = (playlistId: string, trackId: string) =>
  invoke<void>('import_cloud_playlist_track', { playlistId, trackId });

// ── Lyrics ─────────────────────────────────────────────────────────────────────

export interface LyricLine {
  time_ms: number;
  text: string;
}

export interface LyricsResult {
  synced: LyricLine[];
  plain: string;
  has_synced: boolean;
}

export const getLyrics = (title: string, artist: string, durationSecs: number | null) =>
  invoke<LyricsResult>('get_lyrics', {
    title,
    artist,
    durationSecs,
  });

// ── Recommendations ────────────────────────────────────────────────────────────

export const getRecommendations = (youtubeId: string) =>
  invoke<SearchResult[]>('get_recommendations', { youtubeId });

// ── Window management ──────────────────────────────────────────────────────────

export const setMiniPlayer = (enabled: boolean) =>
  invoke<void>('set_mini_player', { enabled });

// ── Download ───────────────────────────────────────────────────────────────────

export const downloadTrack = (trackId: string, youtubeId: string) =>
  invoke<string>('download_track', { trackId, youtubeId });

// ── Equalizer ──────────────────────────────────────────────────────────────────

export const setEqBand = (band: number, db: number) =>
  invoke<void>('set_eq_band', { band, db });
export const getEqBands = () => invoke<number[]>('get_eq_bands');

// ── Global hotkeys ──────────────────────────────────────────────────────────────
// Registered system-wide; remapping persists to settings table.
export const setGlobalHotkey = (action: string, combo: string) =>
  invoke<void>('set_global_hotkey', { action, combo });
export const clearGlobalHotkey = (action: string) =>
  invoke<void>('clear_global_hotkey', { action });
export const getGlobalHotkeys = () =>
  invoke<Record<string, string>>('get_global_hotkeys');
export const resetGlobalHotkeys = () =>
  invoke<Record<string, string>>('reset_global_hotkeys');
