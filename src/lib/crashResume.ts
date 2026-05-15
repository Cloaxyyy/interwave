
import type { Track } from './tauri';

const KEY = 'iw_resume_v1';
const STALE_MS = 24 * 60 * 60 * 1000;

export interface ResumeState {
  track: Track;
  position: number;
  saved_at: number;
}

export function saveResumeState(track: Track | null, position: number) {
  try {
    if (!track) {
      localStorage.removeItem(KEY);
      return;
    }
    const payload: ResumeState = {
      track, position, saved_at: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {}
}

export function loadResumeState(): ResumeState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResumeState;
    if (!parsed?.track || typeof parsed.position !== 'number') return null;
    if (Date.now() - parsed.saved_at > STALE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearResumeState() {
  try { localStorage.removeItem(KEY); } catch {}
}
