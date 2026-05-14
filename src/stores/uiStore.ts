import { create } from 'zustand';

export type View = 'library' | 'search' | 'queue' | 'import' | 'playlist' | 'liked' | 'home' | 'profile' | 'settings' | 'admin' | 'artist' | 'browse';

interface UiStore {
  activeView: View;
  setActiveView: (view: View) => void;
  searchFocused: boolean;
  setSearchFocused: (v: boolean) => void;
  /** ID of the playlist currently shown in PlaylistView (null when not in playlist view) */
  activePlaylistId: string | null;
  /** Name of the playlist currently shown in PlaylistView */
  activePlaylistName: string | null;
  /** Navigate to a specific playlist — sets id, name, and activeView atomically */
  setActivePlaylist: (id: string, name: string) => void;
  /** Currently shown artist's name (for ArtistView). */
  activeArtist: string | null;
  setActiveArtist: (name: string) => void;
  libraryVersion: number;
  bumpLibraryVersion: () => void;
  miniPlayer: boolean;
  setMiniPlayer: (v: boolean) => void;
  /** Right-hand Now Playing panel collapsed to a thin rail */
  rightPanelCollapsed: boolean;
  setRightPanelCollapsed: (v: boolean) => void;
  /** Right-hand Now Playing panel width in px (when expanded). Persisted. */
  rightPanelWidth: number;
  setRightPanelWidth: (px: number) => void;
  /** Fullscreen lyrics overlay shown */
  lyricsFullscreen: boolean;
  setLyricsFullscreen: (v: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  activeView: 'home',
  setActiveView: (view) => set({ activeView: view }),
  searchFocused: false,
  setSearchFocused: (v) => set({ searchFocused: v }),
  activePlaylistId: null,
  activePlaylistName: null,
  setActivePlaylist: (id, name) =>
    set({ activePlaylistId: id, activePlaylistName: name, activeView: 'playlist' }),
  activeArtist: null,
  setActiveArtist: (name) => set({ activeArtist: name, activeView: 'artist' }),
  libraryVersion: 0,
  bumpLibraryVersion: () => set((s) => ({ libraryVersion: s.libraryVersion + 1 })),
  miniPlayer: false,
  setMiniPlayer: (v) => set({ miniPlayer: v }),
  rightPanelCollapsed: (() => {
    try { return localStorage.getItem('iw_right_panel_collapsed') === '1'; }
    catch { return false; }
  })(),
  setRightPanelCollapsed: (v) => {
    try { localStorage.setItem('iw_right_panel_collapsed', v ? '1' : '0'); } catch {}
    set({ rightPanelCollapsed: v });
  },
  rightPanelWidth: (() => {
    try {
      const v = parseInt(localStorage.getItem('iw_right_panel_width') ?? '', 10);
      return Number.isFinite(v) && v >= 280 && v <= 720 ? v : 360;
    } catch { return 360; }
  })(),
  setRightPanelWidth: (px) => {
    const clamped = Math.max(280, Math.min(720, Math.round(px)));
    try { localStorage.setItem('iw_right_panel_width', String(clamped)); } catch {}
    set({ rightPanelWidth: clamped });
  },
  lyricsFullscreen: false,
  setLyricsFullscreen: (v) => set({ lyricsFullscreen: v }),
}));
