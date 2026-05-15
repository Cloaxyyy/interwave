import { useEffect } from 'react';
import { useTauriEvents } from './hooks/useTauriEvents';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useUiStore } from './stores/uiStore';
import { useAuthStore } from './stores/authStore';
import { isSupabaseConfigured } from './lib/supabase';
import { AnimatePresence } from 'motion/react';
import Titlebar from './components/layout/Titlebar';
import Sidebar from './components/layout/Sidebar';
import NowPlayingPanel from './components/layout/NowPlayingPanel';
import PlayerBar from './components/layout/PlayerBar';
import ErrorBoundary from './components/common/ErrorBoundary';
import CommandPalette from './components/common/CommandPalette';
import ResizeHandles from './components/common/ResizeHandles';
import PageTransition from './components/common/PageTransition';
import MaintenanceWall from './components/common/MaintenanceWall';
import LyricsFullscreen from './components/player/LyricsFullscreen';
import UpdatePill from './components/common/UpdatePill';
import ResumeBanner from './components/common/ResumeBanner';
import AnnouncementBanner from './components/common/AnnouncementBanner';
import ToastStack from './components/common/ToastStack';
import LibraryView from './views/LibraryView';
import SearchView from './views/SearchView';
import QueueView from './views/QueueView';
import ImportView from './views/ImportView';
import PlaylistView from './views/PlaylistView';
import LikedSongsView from './views/LikedSongsView';
import HomeView from './views/HomeView';
import ProfileView from './views/ProfileView';
import SettingsView from './views/SettingsView';
import AdminView from './views/AdminView';
import ArtistView from './views/ArtistView';
import BrowseView from './views/BrowseView';
import LoginView from './views/LoginView';
import MiniPlayer from './components/layout/MiniPlayer';
import AdminGate from './components/common/AdminGate';

function ActiveView() {
  const { activeView } = useUiStore();
  switch (activeView) {
    case 'home':     return <HomeView />;
    case 'profile':  return <ProfileView />;
    case 'settings': return <SettingsView />;
    case 'search':   return <SearchView />;
    case 'queue':    return <QueueView />;
    case 'import':   return <ImportView />;
    case 'admin':    return <AdminView />;
    case 'artist':   return <ArtistView />;
    case 'browse':   return <BrowseView />;
    case 'playlist': return <PlaylistView />;
    case 'liked':    return <LikedSongsView />;
    default:         return <LibraryView />;
  }
}

export default function App() {
  useTauriEvents();
  useKeyboardShortcuts();
  const activeView = useUiStore((s) => s.activeView);
  const miniPlayer = useUiStore((s) => s.miniPlayer);
  const { session, loading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (miniPlayer) return <MiniPlayer />;

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
        color: 'var(--text-muted)',
        fontFamily: 'Syne, sans-serif',
        fontSize: 13,
      }}>
        Loading…
      </div>
    );
  }

  try { localStorage.removeItem('interwave_skip_login'); } catch {}
  if (!isSupabaseConfigured) {
    return (
      <div style={{
        height: '100vh', display: 'grid', placeItems: 'center',
        background: 'var(--bg-base)', color: 'var(--text-primary)',
        padding: 32, textAlign: 'center', fontFamily: 'var(--sans)',
      }}>
        <div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, marginBottom: 12 }}>
            Sign-in unavailable
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 420 }}>
            Interwave needs Supabase credentials to manage accounts. Configure
            <code style={{ margin: '0 6px' }}>VITE_SUPABASE_URL</code> and
            <code style={{ margin: '0 6px' }}>VITE_SUPABASE_ANON_KEY</code> and rebuild.
          </p>
        </div>
      </div>
    );
  }
  if (!session) {
    return <LoginView />;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Titlebar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <PageTransition viewKey={activeView}>
                <MaintenanceWall>
                  <ActiveView />
                </MaintenanceWall>
              </PageTransition>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
        <NowPlayingPanel />
      </div>
      <PlayerBar />
      {}
      <CommandPalette />
      {}
      <LyricsFullscreen />
      {}
      <ToastStack />
      {}
      <AnnouncementBanner />
      {}
      <AdminGate />
      {}
      <UpdatePill />
      {}
      <ResumeBanner />
      {}
      <ResizeHandles />
    </div>
  );
}
