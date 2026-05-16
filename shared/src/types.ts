/**
 * Canonical types shared between the Tauri desktop app and the browser webapp.
 * Both apps should converge on these as features land.
 */

export interface DbUserProfile {
  id: string;
  display_name: string | null;
  created_at: string;
}

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
}

export interface Playlist {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  spotify_id?: string | null;
}

export type FriendStatus = 'pending' | 'accepted' | 'blocked';

export interface Friend {
  user_id: string;
  display_name: string;
  status: FriendStatus;
  created_at: number;
}
