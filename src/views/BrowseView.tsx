import { useEffect, useState } from 'react';
import { ArrowSquareOut, GitBranch, Sparkle } from '@phosphor-icons/react';
import { PageShell, PageHeader } from '../components/layout/PageShell';

interface Release {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
}

const REPO = 'Cloaxyyy/wave';
const CACHE_KEY = 'iw_releases_cache_v1';
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheBlob { ts: number; releases: Release[] }

async function fetchReleases(): Promise<Release[]> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const blob = JSON.parse(raw) as CacheBlob;
      if (Date.now() - blob.ts < CACHE_TTL_MS) return blob.releases;
    }
  } catch {}
  const resp = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!resp.ok) throw new Error(`GitHub returned ${resp.status}`);
  const json = await resp.json();
  const releases = (json as Release[]).filter((r) => !r.draft);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), releases } satisfies CacheBlob));
  } catch {}
  return releases;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function renderMarkdown(src: string): React.ReactNode {
  const lines = src.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuf: string[] = [];
  let key = 0;
  const flushList = () => {
    if (listBuf.length === 0) return;
    blocks.push(
      <ul key={key++} style={{
        margin: '6px 0 14px 0', paddingLeft: 22,
        color: 'var(--text-secondary)',
        fontSize: 13.5, lineHeight: 1.6,
      }}>
        {listBuf.map((it, j) => <li key={j} style={{ marginBottom: 4 }}>{renderInline(it)}</li>)}
      </ul>
    );
    listBuf = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*$/.test(line)) { flushList(); continue; }
    if (line.startsWith('## ')) {
      flushList();
      blocks.push(
        <h3 key={key++} style={{
          fontFamily: 'var(--sans)', fontSize: 17, fontWeight: 600,
          letterSpacing: '-0.01em', color: 'var(--text-primary)',
          marginTop: 22, marginBottom: 8,
        }}>{line.slice(3)}</h3>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      flushList();
      blocks.push(
        <h4 key={key++} style={{
          fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600,
          color: 'var(--text-primary)', marginTop: 14, marginBottom: 6,
        }}>{line.slice(4)}</h4>
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      listBuf.push(line.replace(/^\s*[-*]\s+/, ''));
      continue;
    }
    if (line.startsWith('---')) {
      flushList();
      blocks.push(<hr key={key++} style={{ border: 'none', height: 1, background: 'var(--border-subtle)', margin: '16px 0' }}/>);
      continue;
    }
    flushList();
    blocks.push(
      <p key={key++} style={{
        margin: '6px 0', color: 'var(--text-secondary)',
        fontSize: 13.5, lineHeight: 1.6,
      }}>{renderInline(line)}</p>
    );
  }
  flushList();
  return blocks;
}

function renderInline(text: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={key++} style={{ color: 'var(--text-primary)' }}>{m[1]}</strong>);
    else if (m[2]) out.push(<code key={key++} style={{ fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4, color: 'var(--accent)' }}>{m[2]}</code>);
    else if (m[3]) out.push(<a key={key++} href={m[4]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{m[3]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function BrowseView() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchReleases()
      .then((r) => { if (!cancelled) { setReleases(r); setError(null); } })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <PageShell width="normal">
      <PageHeader
        eyebrow="What's new"
        title="Release notes"
        subtitle="Every Interwave update, straight from the GitHub release feed."
      />

      {loading && (
        <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontSize: 13 }}>
          Loading releases…
        </div>
      )}

      {error && !loading && (
        <div style={{
          padding: 14, borderRadius: 10,
          background: 'rgba(255,180,80,0.08)',
          border: '1px solid rgba(255,180,80,0.30)',
          color: '#ffb84d',
          fontFamily: 'var(--sans)', fontSize: 12.5, lineHeight: 1.5,
        }}>
          Couldn't reach GitHub: {error}. Check your connection and try again.
        </div>
      )}

      {!loading && !error && releases.length === 0 && (
        <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontSize: 13 }}>
          No releases published yet.
        </div>
      )}

      {!loading && releases.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {releases.map((r, i) => (
            <article
              key={r.tag_name}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid color-mix(in oklch, var(--border-subtle) 70%, transparent)',
                borderRadius: 14,
                padding: '22px 26px',
                position: 'relative',
              }}
            >
              {i === 0 && (
                <span style={{
                  position: 'absolute', top: 16, right: 18,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 999,
                  background: 'color-mix(in oklch, var(--accent) 16%, transparent)',
                  color: 'var(--accent)',
                  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  <Sparkle size={10} weight="fill" />
                  Latest
                </span>
              )}
              <header style={{ marginBottom: 10 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'var(--mono)', fontSize: 10.5,
                  color: 'var(--text-muted)', letterSpacing: '0.06em',
                  textTransform: 'uppercase', marginBottom: 6,
                }}>
                  <GitBranch size={11} weight="bold" />
                  <span>{r.tag_name}</span>
                  <span>·</span>
                  <span>{formatDate(r.published_at)}</span>
                  {r.prerelease && (
                    <>
                      <span>·</span>
                      <span style={{ color: '#ffb84d' }}>Pre-release</span>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
                  <h2 style={{
                    fontFamily: 'var(--sans)', fontSize: 22, fontWeight: 700,
                    letterSpacing: '-0.015em', color: 'var(--text-primary)', margin: 0,
                  }}>{r.name || r.tag_name}</h2>
                  <a
                    href={r.html_url}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontFamily: 'var(--sans)', fontSize: 11,
                      color: 'var(--text-muted)', textDecoration: 'none',
                      flexShrink: 0,
                    }}
                  >
                    GitHub <ArrowSquareOut size={11} weight="bold" />
                  </a>
                </div>
              </header>
              <div>{renderMarkdown(r.body || '_No release notes._')}</div>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
