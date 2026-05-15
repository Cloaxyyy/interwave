import { useEffect, useState } from 'react';
import { Play, ArrowRight } from '@phosphor-icons/react';
import { useUiStore } from '../stores/uiStore';
import { usePlayerStore } from '../stores/playerStore';
import {
  getRecentlyPlayed, getStats, getAllPlaylists, getLikedTracks, playTrack,
  type RecentTrack, type ListeningStats, type Playlist,
} from '../lib/tauri';

const QUICK = [
  { id: 'q1', name: 'Liked Songs', view: 'liked'   as const, grad: 'var(--grad-twilight)' },
  { id: 'q2', name: 'Library',     view: 'library' as const, grad: 'var(--grad-aurora)' },
  { id: 'q3', name: 'Search',      view: 'search'  as const, grad: 'linear-gradient(135deg, oklch(0.55 0.18 320), oklch(0.32 0.20 285))' },
];

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Up late';
}

export default function HomeView() {
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setActivePlaylist = useUiStore((s) => s.setActivePlaylist);
  const { currentTrack, playbackState } = usePlayerStore();
  const isPlaying = playbackState === 'playing';

  const [recent, setRecent]       = useState<RecentTrack[]>([]);
  const [stats, setStats]         = useState<ListeningStats | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [likedHero, setLikedHero] = useState<string | null>(null);

  useEffect(() => {
    getRecentlyPlayed().then(r => setRecent(r.slice(0, 8))).catch(console.error);
    getStats().then(setStats).catch(console.error);
    getAllPlaylists().then(setPlaylists).catch(console.error);
    getLikedTracks().then(t => {
      const first = t.find(x => x.thumbnail_url);
      if (first?.thumbnail_url) setLikedHero(first.thumbnail_url);
    }).catch(() => {});
  }, []);

  const playRecent = (r: RecentTrack) => {
    playTrack({
      video_id: r.youtube_id,
      title: r.title,
      artist: r.artist,
      duration_seconds: null,
      thumbnail_url: r.thumbnail_url,
    }).catch(console.error);
  };

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
    <div style={{ padding: '20px 28px 56px', maxWidth: 1280 }}>

      {}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 18,
      }}>
        <div>
          <p style={{
            fontFamily: 'var(--mono)', fontSize: 11,
            color: 'var(--text-muted)', letterSpacing: '0.10em',
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 style={{
            fontFamily: 'var(--serif)',
            fontSize: 'clamp(40px, 5vw, 56px)',
            lineHeight: 1, letterSpacing: '-0.02em',
            margin: 0, fontWeight: 400,
          }}>
            {greeting()}
          </h1>
        </div>
        {currentTrack && (
          <button
            onClick={() => setActiveView('queue')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px', borderRadius: 999,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'background 160ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-overlay)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
          >
            {currentTrack.thumbnail_url && (
              <img src={currentTrack.thumbnail_url} alt="" draggable={false}
                style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover' }} />
            )}
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
              {isPlaying ? 'Now playing' : 'Resume'} — {currentTrack.title}
            </span>
            <ArrowRight size={12} weight="bold" color="var(--text-muted)" />
          </button>
        )}
      </div>

      {}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10, marginBottom: 36,
      }}>
        {QUICK.map(({ id, name, view, grad }) => (
          <button
            key={id}
            onClick={() => setActiveView(view)}
            className="card-hover"
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: 'var(--bg-surface)',
              borderRadius: 8,
              padding: 0, paddingRight: 16,
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              minHeight: 64,
              textAlign: 'left',
              overflow: 'hidden',
              position: 'relative',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
          >
            <div style={{
              width: 64, height: 64, flexShrink: 0,
              background: id === 'q1' && likedHero
                ? `center/cover url(${likedHero})`
                : grad,
            }}/>
            <span style={{
              flex: 1,
              fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              {name}
            </span>
          </button>
        ))}
      </div>

      {}
      <Section title="Recently played" actionLabel="See all" onAction={() => setActiveView('library')}>
        {recent.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
            gap: 18,
          }}>
            {recent.map((r) => (
              <Card
                key={r.track_id}
                title={r.title}
                subtitle={r.artist}
                cover={r.thumbnail_url}
                onPlay={() => playRecent(r)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            emoji="🎧"
            title="Nothing here yet"
            sub="Search for a song and play it — it'll show up here."
            ctaLabel="Open search"
            onCta={() => setActiveView('search')}
          />
        )}
      </Section>

      {}
      {playlists.length > 0 && (
        <Section title="Your playlists" actionLabel="Library" onAction={() => setActiveView('library')}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
            gap: 18,
          }}>
            {playlists.slice(0, 8).map((p) => (
              <Card
                key={p.id}
                title={p.name}
                subtitle="Playlist"
                cover={null}
                gradientHash={p.name}
                onPlay={() => setActivePlaylist(p.id, p.name)}
                onClick={() => setActivePlaylist(p.id, p.name)}
              />
            ))}
          </div>
        </Section>
      )}

      {}
      {stats && (
        <div style={{
          marginTop: 32, paddingTop: 18,
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex', gap: 28, flexWrap: 'wrap',
          fontFamily: 'var(--sans)', fontSize: 12,
          color: 'var(--text-muted)',
        }}>
          <span><strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{stats.total_liked}</strong> liked</span>
          <span><strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{stats.total_tracks}</strong> tracks in library</span>
          <span><strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatHours(stats.hours_this_month)}</strong> this month</span>
        </div>
      )}
    </div>
    </div>
  );
}

function Section({
  title, actionLabel, onAction, children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 18,
      }}>
        <h2 style={{
          fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400,
          letterSpacing: '-0.02em', margin: 0, color: 'var(--text-primary)',
        }}>{title}</h2>
        {actionLabel && (
          <button
            onClick={onAction}
            style={{
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-muted)',
              background: 'none', border: 'none', cursor: 'pointer',
              transition: 'color 160ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            {actionLabel} →
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Card({
  title, subtitle, cover, gradientHash,
  onPlay, onClick,
}: {
  title: string;
  subtitle?: string;
  cover: string | null;
  gradientHash?: string;
  onPlay: () => void;
  onClick?: () => void;
}) {

  let h = 0;
  const src = gradientHash ?? title;
  for (let i = 0; i < src.length; i++) h = ((h << 5) - h) + src.charCodeAt(i);
  const hue = Math.abs(h % 360);
  const gradient = `linear-gradient(135deg, oklch(0.55 0.18 ${hue}), oklch(0.30 0.20 ${(hue + 40) % 360}))`;

  return (
    <div
      onClick={onClick ?? onPlay}
      className="card-hover"
      style={{
        position: 'relative',
        background: 'var(--bg-surface)',
        borderRadius: 10,
        padding: 12,
        cursor: 'pointer',
        border: '1px solid var(--border-subtle)',
      }}
      onMouseEnter={e => {
        const target = e.currentTarget as HTMLElement;
        target.style.background = 'var(--bg-elevated)';
        const overlay = target.querySelector<HTMLElement>('.card-play');
        if (overlay) {
          overlay.style.opacity = '1';
          overlay.style.transform = 'translateY(0)';
        }
      }}
      onMouseLeave={e => {
        const target = e.currentTarget as HTMLElement;
        target.style.background = 'var(--bg-surface)';
        const overlay = target.querySelector<HTMLElement>('.card-play');
        if (overlay) {
          overlay.style.opacity = '0';
          overlay.style.transform = 'translateY(8px)';
        }
      }}
    >
      <div style={{
        position: 'relative', aspectRatio: '1', borderRadius: 8,
        overflow: 'hidden', marginBottom: 10,
        background: cover ? `center/cover url(${cover})` : gradient,
        boxShadow: '0 8px 20px -10px rgba(0,0,0,0.5)',
      }}>
        <button
          className="card-play"
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          style={{
            position: 'absolute', right: 10, bottom: 10,
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--accent)', color: 'var(--accent-ink)',
            display: 'grid', placeItems: 'center',
            border: 'none', cursor: 'pointer',
            opacity: 0, transform: 'translateY(8px)',
            transition: 'opacity 220ms, transform 220ms, scale 120ms',
            boxShadow: 'var(--shadow-accent)',
          }}
        >
          <Play size={14} weight="fill" />
        </button>
      </div>
      <div style={{
        fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
        color: 'var(--text-primary)', marginBottom: 4,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{title}</div>
      {subtitle && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10.5,
          color: 'var(--text-muted)', letterSpacing: '0.04em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{subtitle}</div>
      )}
    </div>
  );
}

function EmptyState({
  emoji, title, sub, ctaLabel, onCta,
}: {
  emoji: string; title: string; sub: string; ctaLabel: string; onCta: () => void;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', borderRadius: 14,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)', gap: 12,
    }}>
      <span style={{ fontSize: 42, lineHeight: 1 }}>{emoji}</span>
      <p style={{
        fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600,
        color: 'var(--text-primary)', margin: 0,
      }}>{title}</p>
      <p style={{
        fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-secondary)',
        margin: 0, textAlign: 'center', maxWidth: 360,
      }}>{sub}</p>
      <button onClick={onCta} className="btn-primary" style={{ marginTop: 6 }}>
        {ctaLabel} →
      </button>
    </div>
  );
}
