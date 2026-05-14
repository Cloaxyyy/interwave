import { useEffect, useState } from 'react';
import {
  getStats, getTopArtists, getRecentlyPlayed,
  type ListeningStats, type TopArtist, type RecentTrack
} from '../lib/tauri';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';

function timeAgo(unixSecs: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSecs;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  return `${Math.floor(diff / 86400)}d ago`;
}

const ARTIST_COLORS = [
  'oklch(0.72 0.09 300)',
  'oklch(0.70 0.09 180)',
  'oklch(0.68 0.09 20)',
  'oklch(0.72 0.08 80)',
  'oklch(0.70 0.09 260)',
];

export default function ProfileView() {
  const { user, displayName, role, isStaff, setRole: storeSetRole } = useAuthStore();
  const libraryVersion = useUiStore((s) => s.libraryVersion);
  const [stats, setStats] = useState<ListeningStats | null>(null);
  const [topArtists, setTopArtists] = useState<TopArtist[]>([]);
  const [recent, setRecent] = useState<RecentTrack[]>([]);

  useEffect(() => {
    getStats().then(setStats).catch(console.error);
    getTopArtists().then(setTopArtists).catch(console.error);
    getRecentlyPlayed().then((r) => setRecent(r.slice(0, 6))).catch(console.error);
  }, [libraryVersion]); // re-fetch whenever library changes (like/unlike, playlist add/delete)

  const statCards = stats ? [
    { label: 'Songs in library', value: stats.total_tracks.toLocaleString() },
    { label: 'Hours this month',  value: `${stats.hours_this_month.toFixed(0)}h` },
    { label: 'Playlists',         value: stats.total_playlists.toLocaleString() },
    { label: 'Songs loved',       value: stats.total_liked.toLocaleString() },
  ] : [
    { label: 'Songs in library', value: '—' },
    { label: 'Hours this month',  value: '—' },
    { label: 'Playlists',         value: '—' },
    { label: 'Songs loved',       value: '—' },
  ];

  return (
    <div style={{ padding: '0 0 56px', overflowY: 'auto', height: '100%' }}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', height: 320,
        borderRadius: 'var(--r-xl)', overflow: 'hidden',
        marginBottom: 32, display: 'flex', alignItems: 'flex-end',
        padding: '28px 36px',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, oklch(0.36 0.06 300), oklch(0.22 0.03 280))',
        }}/>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, var(--bg-base) 0%, transparent 65%)',
        }}/>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 28, alignItems: 'flex-end', width: '100%' }}>
          {/* Avatar */}
          <div style={{
            width: 160, height: 160, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, oklch(0.78 0.09 300), oklch(0.55 0.11 280))',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--serif)', fontSize: 68, color: 'var(--accent-ink)',
            boxShadow: '0 20px 50px -10px rgba(0,0,0,0.7)',
          }}>
            {(displayName ?? user?.email ?? 'L')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.08em', marginBottom: 6, textTransform: 'uppercase' }}>
              Profile
            </p>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 48, lineHeight: 1, color: 'var(--text-primary)', marginBottom: 12 }}>
              {displayName ?? user?.email?.split('@')[0] ?? 'Listener'}
            </h1>
            {user?.email && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{user.email}</p>}
            {/* Role badge + UID for support / debugging */}
            {user && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                  padding: '3px 8px', borderRadius: 4,
                  background: isStaff ? 'var(--accent-dim)' : 'var(--bg-overlay)',
                  color: isStaff ? 'var(--accent)' : 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  ROLE · {role}
                </span>
                <code style={{
                  fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)',
                  padding: '3px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: 4,
                  cursor: 'pointer',
                }} title="Click to copy your Supabase UID"
                  onClick={() => { navigator.clipboard.writeText(user.id).catch(() => {}); }}
                >
                  UID {user.id}
                </code>
                <button
                  onClick={async () => {
                    try {
                      const { getMyRole } = await import('../lib/admin');
                      const r = await getMyRole();
                      storeSetRole(r);
                    } catch {}
                  }}
                  style={{
                    fontFamily: 'var(--mono)', fontSize: 10,
                    padding: '3px 8px', borderRadius: 4,
                    background: 'transparent', border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                  }}
                  title="Re-query Supabase for your role right now"
                >
                  ↻ refresh role
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {statCards.map((s) => (
                <div key={s.label}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 36px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>

        {/* Top Artists */}
        <section>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, marginBottom: 16, color: 'var(--text-primary)' }}>
            Top Artists
          </h2>
          {topArtists.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Play some tracks to see your top artists.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {topArtists.slice(0, 5).map((a, i) => (
                <div key={a.name} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px', borderRadius: 8,
                  background: 'var(--bg-surface)',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 16, textAlign: 'center' }}>
                    {i + 1}
                  </span>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: ARTIST_COLORS[i % ARTIST_COLORS.length],
                    display: 'grid', placeItems: 'center',
                    fontSize: 14, color: '#fff',
                  }}>
                    {a.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{a.play_count} plays</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, marginBottom: 16, color: 'var(--text-primary)' }}>
            Recent Activity
          </h2>
          {recent.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No listening history yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recent.map((r) => (
                <div key={r.track_id + r.played_at} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px', borderRadius: 8,
                  background: 'var(--bg-surface)',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 6, flexShrink: 0,
                    background: r.thumbnail_url ? 'transparent' : 'var(--bg-overlay)',
                    backgroundImage: r.thumbnail_url ? `url(${r.thumbnail_url})` : 'none',
                    backgroundSize: 'cover', backgroundPosition: 'center',
                  }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.artist}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {timeAgo(r.played_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
