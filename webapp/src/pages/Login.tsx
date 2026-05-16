import { useState, type FormEvent } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type Mode = 'sign-in' | 'sign-up';

export function Login() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured for this build.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'sign-in') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        if (!data.session) {
          setInfo('Check your email to confirm your account, then sign in.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="iw-shell">
      <header className="iw-header">
        <a className="iw-brand" href="/">
          <span className="iw-wordmark">
            inter<em>wave</em>
          </span>
        </a>
      </header>

      <main className="iw-main iw-center">
        <div className="iw-card">
          <h1 className="iw-title">
            {mode === 'sign-in' ? <>Sign <em>in</em></> : <>Create <em>account</em></>}
          </h1>
          <p className="iw-sub">
            {mode === 'sign-in'
              ? 'Welcome back. Pick up where you left off.'
              : 'Start building your library in the browser.'}
          </p>

          <form onSubmit={onSubmit} className="iw-form">
            <label className="iw-label">
              <span>Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="iw-input"
                placeholder="you@example.com"
              />
            </label>

            <label className="iw-label">
              <span>Password</span>
              <input
                type="password"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="iw-input"
                placeholder="At least 8 characters"
              />
            </label>

            {error && <div className="iw-alert iw-alert-error">{error}</div>}
            {info && <div className="iw-alert iw-alert-info">{info}</div>}

            <button type="submit" className="iw-btn iw-btn-primary" disabled={busy}>
              {busy ? 'Working…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <button
            type="button"
            className="iw-toggle"
            onClick={() => {
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
              setError(null);
              setInfo(null);
            }}
          >
            {mode === 'sign-in'
              ? "Don't have an account? Create one →"
              : 'Already have an account? Sign in →'}
          </button>
        </div>
      </main>
    </div>
  );
}
