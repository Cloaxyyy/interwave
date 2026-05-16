import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function Dashboard() {
  const displayName = useAuthStore((s) => s.displayName);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const greeting = displayName ?? user?.email ?? 'friend';

  return (
    <div className="iw-shell">
      <header className="iw-header">
        <a className="iw-brand" href="/">
          <span className="iw-wordmark">
            inter<em>wave</em>
          </span>
        </a>
        <button type="button" className="iw-btn iw-btn-ghost" onClick={signOut}>
          Sign out
        </button>
      </header>

      <main className="iw-main iw-center">
        <div className="iw-card iw-card-hero">
          <div className="iw-pill">
            <span className="iw-pill-dot" />
            BETA · WEB PLAYER
          </div>
          <h1 className="iw-title">
            Welcome, <em>{greeting}</em>
          </h1>
          <p className="iw-sub">
            You're signed in. Listen anywhere — your library and playlists sync
            from the desktop app and play right in the browser.
          </p>
          <div className="iw-cta-row">
            <Link className="iw-btn iw-btn-primary" to="/library">
              Your library
            </Link>
            <Link className="iw-btn iw-btn-ghost" to="/browse">
              Browse public
            </Link>
            <a
              className="iw-btn iw-btn-ghost"
              href="https://github.com/Cloaxyyy/wave/releases/latest"
              target="_blank"
              rel="noopener"
            >
              Desktop app
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
