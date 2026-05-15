import { useEffect, lazy, Suspense } from 'react';
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
import ShortcutOverlay from './components/common/ShortcutOverlay';
import OnboardingModal from './components/common/OnboardingModal';
import HomeView from './views/HomeView';
import LibraryView from './views/LibraryView';
import LoginView from './views/LoginView';
import { usePlayerStore } from './stores/playerStore';
import { useFriendsStore, startPresence, stopPresence, broadcastNowPlaying } from './stores/friendsStore';
import MiniPlayer from './components/layout/MiniPlayer';
import AdminGate from './components/common/AdminGate';

const SearchView = lazy(() => import('./views/SearchView'));
const FriendsView = lazy(() => import('./views/FriendsView'));
const SupportView = lazy(() => import('./views/SupportView'));
const QueueView = lazy(() => import('./views/QueueView'));
const ImportView = lazy(() => import('./views/ImportView'));
const PlaylistView = lazy(() => import('./views/PlaylistView'));
const LikedSongsView = lazy(() => import('./views/LikedSongsView'));
const ProfileView = lazy(() => import('./views/ProfileView'));
const SettingsView = lazy(() => import('./views/SettingsView'));
const AdminView = lazy(() => import('./views/AdminView'));
const ArtistView = lazy(() => import('./views/ArtistView'));
const BrowseView = lazy(() => import('./views/BrowseView'));

function ViewFallback() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--sans)' }}>
      Loading…
    </div>
  );
}

function ActiveView() {
  const { activeView } = useUiStore();
  const node = (() => {
    switch (activeView) {
      case 'home':     return <HomeView />;
      case 'profile':  return <ProfileView />;
      case 'settings': return <SettingsView />;
      case 'search':   return <SearchView />;
      case 'friends':  return <FriendsView />;
      case 'support':  return <SupportView />;
      case 'queue':    return <QueueView />;
      case 'import':   return <ImportView />;
      case 'admin':    return <AdminView />;
      case 'artist':   return <ArtistView />;
      case 'browse':   return <BrowseView />;
      case 'playlist': return <PlaylistView />;
      case 'liked':    return <LikedSongsView />;
      default:         return <LibraryView />;
    }
  })();
  return <Suspense fallback={<ViewFallback />}>{node}</Suspense>;
}

export default function App() {
  useTauriEvents();
  useKeyboardShortcuts();
  const activeView = useUiStore((s) => s.activeView);
  const miniPlayer = useUiStore((s) => s.miniPlayer);
  const { session, loading, initialize, displayName } = useAuthStore();
  const { currentTrack, playbackState, position, duration } = usePlayerStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!session?.user) { stopPresence(); return; }
    const me = session.user.id;
    const myName = displayName ?? session.user.email ?? 'Anonymous';
    useFriendsStore.getState().load();
    startPresence(me, myName);
    return () => { stopPresence(); };
  }, [session?.user?.id, displayName]);

  useEffect(() => {
    if (!session?.user) return;
    const myName = displayName ?? session.user.email ?? 'Anonymous';
    if (!currentTrack) {
      broadcastNowPlaying({ display_name: myName, track: null });
      return;
    }
    if (playbackState !== 'playing' && playbackState !== 'paused') {
      broadcastNowPlaying({ display_name: myName, track: null });
      return;
    }
    broadcastNowPlaying({
      display_name: myName,
      track: {
        title: currentTrack.title,
        artist: currentTrack.artist,
        thumbnail_url: currentTrack.thumbnail_url,
        state: playbackState === 'playing' ? 'playing' : 'paused',
        position,
        duration,
      },
    });
  }, [
    session?.user?.id,
    displayName,
    currentTrack?.id,
    playbackState,

    Math.floor(position / 5),
    duration,
  ]);

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
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)', position: 'relative' }}>
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
      <OnboardingModal />
      {}
      <ShortcutOverlay />
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
