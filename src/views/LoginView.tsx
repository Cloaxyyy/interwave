import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

type Mode = 'login' | 'register';

export default function LoginView() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const { setSession, setDisplayName: storeSetDisplayName } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        const resolvedName = displayName.trim() || email.split('@')[0];
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: resolvedName } },
        });
        if (err) throw err;
        if (data.session) {

          await supabase
            .from('user_profiles')
            .upsert({ id: data.session.user.id, display_name: resolvedName })
            .eq('id', data.session.user.id);
          storeSetDisplayName(resolvedName);
          setSession(data.session);
        } else {
          setSuccess('Account created! Check your email to confirm, then sign in.');
          setMode('login');
        }
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        if (data.session) {

          const { data: profile } = await supabase
            .from('user_profiles')
            .select('display_name')
            .eq('id', data.session.user.id)
            .single();
          const name =
            profile?.display_name ??
            (data.session.user.user_metadata?.display_name as string | undefined) ??
            email.split('@')[0];
          storeSetDisplayName(name);
          setSession(data.session);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
    padding: '10px 14px',
    borderRadius: 8,
    fontFamily: 'Syne, sans-serif',
    fontSize: 13,
    outline: 'none',
    transition: 'border-color 150ms',
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {}
      <div style={{
        position: 'absolute',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,255,87,0.08) 0%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}/>

      <div style={{
        width: 400,
        position: 'relative',
        zIndex: 1,
      }}>
        {}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 36,
            fontWeight: 800,
            color: 'var(--accent)',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            marginBottom: 6,
          }}>
            INTERWAVE
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'Syne, sans-serif' }}>
            {mode === 'login' ? 'Sign in to sync your library' : 'Create your account'}
          </p>
        </div>

        {}
        <div style={{
          display: 'flex',
          background: 'var(--bg-surface)',
          borderRadius: 10,
          padding: 4,
          marginBottom: 24,
        }}>
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setSuccess(null); }}
              style={{
                flex: 1,
                padding: '7px 0',
                borderRadius: 7,
                border: 'none',
                background: mode === m ? 'var(--bg-elevated)' : 'transparent',
                color: mode === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontFamily: 'Syne, sans-serif',
                fontSize: 12,
                fontWeight: mode === m ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontFamily: 'Syne, sans-serif' }}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontFamily: 'Syne, sans-serif' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontFamily: 'Syne, sans-serif' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
              required
              minLength={mode === 'register' ? 6 : undefined}
              style={inputStyle}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: 'var(--destructive)', padding: '8px 12px', background: 'rgba(255,68,68,0.08)', borderRadius: 6, fontFamily: 'Syne, sans-serif' }}>
              {error}
            </p>
          )}

          {success && (
            <p style={{ fontSize: 12, color: 'var(--success)', padding: '8px 12px', background: 'rgba(87,255,140,0.08)', borderRadius: 6, fontFamily: 'Syne, sans-serif' }}>
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 0',
              marginTop: 4,
              borderRadius: 8,
              border: 'none',
              background: loading ? 'var(--bg-elevated)' : 'var(--accent)',
              color: loading ? 'var(--text-muted)' : '#000',
              fontFamily: 'Syne, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              transition: 'all 150ms',
            }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {}
      </div>
    </div>
  );
}
