import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { CircleNotch, CheckCircle, XCircle, FolderOpen, FileArrowDown, Link, ShareNetwork } from '@phosphor-icons/react';
import { spotifyImportFile, importSpotifyUrl, createPlaylist, addTrackToPlaylist, saveTrackFromSearch } from '../lib/tauri';
import { PageShell, PageHeader } from '../components/layout/PageShell';
import type { ImportProgressEvent, ImportCompleteEvent } from '../lib/tauri';
import { useImportStore } from '../stores/importStore';
import { fetchSharedPlaylist, ShareError } from '../lib/sharing';
import { useUiStore } from '../stores/uiStore';
import { useToastStore } from '../stores/toastStore';

const SPIN_KEYFRAME = `@keyframes spin { to { transform: rotate(360deg); } }`;

export default function ImportView() {
  const {
    importStatus,
    importProgress,
    importResult,
    importError,
    setImportStatus,
    setImportProgress,
    setImportResult,
    setImportError,
    resetImport,
  } = useImportStore();

  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [shareToken, setShareToken] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const bumpLibraryVersion = useUiStore((s) => s.bumpLibraryVersion);
  const pushToast = useToastStore((s) => s.push);

  const handleImportShare = async () => {
    if (!shareToken.trim() || shareBusy) return;
    setShareBusy(true);
    try {
      const snap = await fetchSharedPlaylist(shareToken);
      const newPlaylist = await createPlaylist(`${snap.name} (imported)`);
      let added = 0;
      for (const t of snap.tracks) {
        try {
          const saved = await saveTrackFromSearch(
            t.youtube_id, t.title, t.artist, t.duration_seconds, t.thumbnail_url,
          );
          await addTrackToPlaylist(newPlaylist.id, saved);
          added += 1;
        } catch (e) {
          console.error('share import: skipped track', t.title, e);
        }
      }
      bumpLibraryVersion();
      pushToast({
        kind: 'success',
        title: `Imported "${snap.name}"`,
        body: `${added} of ${snap.tracks.length} tracks added.`,
        duration: 4500,
      });
      setShareToken('');
    } catch (e) {
      const msg = e instanceof ShareError ? e.message : String(e);
      pushToast({ kind: 'error', title: 'Could not import share', body: msg, duration: 5500 });
    } finally {
      setShareBusy(false);
    }
  };

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    listen<ImportProgressEvent>('import://progress', (e) => {
      setImportProgress(e.payload);
    }).then((u) => cleanups.push(u));

    listen<ImportCompleteEvent>('import://complete', (e) => {
      setImportResult(e.payload);
    }).then((u) => cleanups.push(u));

    return () => cleanups.forEach((u) => u());
  }, []);

  const handlePickFile = async () => {
    if (importStatus === 'importing') return;

    const selected = await open({
      multiple: false,
      filters: [{ name: 'Spotify Export JSON', extensions: ['json'] }],
    });

    if (!selected) return;
    const filePath = typeof selected === 'string' ? selected : (selected as any)?.path ?? '';

    resetImport();
    setImportStatus('importing');
    try {
      await spotifyImportFile(filePath);

    } catch (err) {
      const msg = err instanceof Error ? err.message :
        typeof err === 'object' && err !== null ?
          ((err as any).message ?? (err as any).error ?? JSON.stringify(err)) :
          String(err);
      setImportError(msg);
    }
  };

  const handleUrlImport = async () => {
    const trimmed = spotifyUrl.trim();
    if (!trimmed || isImporting) return;
    resetImport();
    setImportStatus('importing');
    try {
      await importSpotifyUrl(trimmed);

    } catch (err) {
      const msg = err instanceof Error ? err.message :
        typeof err === 'object' && err !== null ?
          ((err as any).message ?? (err as any).error ?? JSON.stringify(err)) :
          String(err);
      setImportError(msg);
    }
  };

  const isImporting = importStatus === 'importing';

  return (
    <PageShell width="narrow">
      <style>{SPIN_KEYFRAME}</style>
      <PageHeader
        eyebrow="Bring your music"
        title="Import"
        subtitle="Bring your Spotify library and playlists into Interwave."
      />

      <div>

        {}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '18px 20px',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <FileArrowDown size={18} color="var(--accent)" weight="duotone" />
            <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Get your Spotify data
            </p>
          </div>

          <ol style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              <>Go to <span style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>spotify.com/account/privacy</span></>,
              <>Click <strong style={{ color: 'var(--text-primary)' }}>Download your data</strong> → request the export</>,
              <>Wait for Spotify's email (a few hours) → download the ZIP</>,
              <>Unzip it — you'll find <span style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>YourLibrary.json</span> and <span style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>Playlist1.json</span></>,
              <>Click the button below and select either file</>,
            ].map((step, i) => (
              <li key={i} style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {}
        <button
          onClick={handlePickFile}
          disabled={isImporting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: isImporting ? 'var(--bg-overlay)' : 'var(--accent-dim)',
            border: `1px solid ${isImporting ? 'var(--border-subtle)' : 'var(--accent)'}`,
            borderRadius: 8,
            color: isImporting ? 'var(--text-muted)' : 'var(--accent)',
            fontFamily: 'Syne, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 18px',
            cursor: isImporting ? 'default' : 'pointer',
            width: '100%',
            transition: 'background 150ms',
            marginBottom: 20,
          }}
        >
          <FolderOpen size={16} weight="duotone" />
          Select Spotify export file…
        </button>

        {}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '18px 20px',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <ShareNetwork size={16} color="var(--accent)" weight="duotone" />
            <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Import from a friend's share link
            </p>
          </div>
          <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            Paste a token or <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--accent)' }}>interwave://share/&lt;token&gt;</code> link. We'll snapshot the shared playlist and add it to your library.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={shareToken}
              onChange={(e) => setShareToken(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleImportShare(); }}
              placeholder="interwave://share/…"
              disabled={shareBusy}
              style={{
                flex: 1,
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border-default)',
                borderRadius: 6, color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5,
                padding: '8px 12px', outline: 'none',
                opacity: shareBusy ? 0.5 : 1,
              }}
            />
            <button
              onClick={handleImportShare}
              disabled={shareBusy || !shareToken.trim()}
              style={{
                background: shareBusy || !shareToken.trim() ? 'var(--bg-overlay)' : 'var(--accent-dim)',
                border: `1px solid ${shareBusy || !shareToken.trim() ? 'var(--border-subtle)' : 'var(--accent)'}`,
                borderRadius: 6,
                color: shareBusy || !shareToken.trim() ? 'var(--text-muted)' : 'var(--accent)',
                fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 600,
                padding: '8px 16px', cursor: shareBusy || !shareToken.trim() ? 'default' : 'pointer',
                flexShrink: 0,
              }}
            >
              {shareBusy ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>

        {}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '18px 20px',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Link size={16} color="var(--accent)" weight="duotone" />
            <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Import from Spotify URL
            </p>
          </div>
          <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            Paste a public Spotify playlist link — tracks are matched on YouTube automatically.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleUrlImport(); }}
              placeholder="https://open.spotify.com/playlist/…"
              disabled={isImporting}
              style={{
                flex: 1,
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontFamily: 'Syne, sans-serif',
                fontSize: 12,
                padding: '8px 12px',
                outline: 'none',
                opacity: isImporting ? 0.5 : 1,
              }}
            />
            <button
              onClick={handleUrlImport}
              disabled={isImporting || !spotifyUrl.trim()}
              style={{
                background: isImporting || !spotifyUrl.trim() ? 'var(--bg-overlay)' : 'var(--accent-dim)',
                border: `1px solid ${isImporting || !spotifyUrl.trim() ? 'var(--border-subtle)' : 'var(--accent)'}`,
                borderRadius: 6,
                color: isImporting || !spotifyUrl.trim() ? 'var(--text-muted)' : 'var(--accent)',
                fontFamily: 'Syne, sans-serif',
                fontSize: 12,
                fontWeight: 600,
                padding: '8px 16px',
                cursor: isImporting || !spotifyUrl.trim() ? 'default' : 'pointer',
                flexShrink: 0,
                transition: 'background 150ms, border-color 150ms, color 150ms',
              }}
            >
              Import
            </button>
          </div>
        </div>

        {}
        {isImporting && !importProgress && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            <CircleNotch size={18} color="var(--accent)" weight="bold" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--text-muted)' }}>
              Starting import…
            </p>
          </div>
        )}

        {}
        {isImporting && importProgress && (
          <ProgressPanel progress={importProgress} />
        )}

        {}
        {importStatus === 'done' && importResult && (
          <ResultPanel result={importResult} onDismiss={resetImport} />
        )}

        {}
        {importStatus === 'error' && importError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '12px 14px',
              background: 'rgba(255, 68, 68, 0.08)',
              border: '1px solid rgba(255, 68, 68, 0.2)',
              borderRadius: 8,
            }}
          >
            <XCircle size={16} color="var(--destructive)" weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, color: 'var(--destructive)', lineHeight: 1.5 }}>
                {importError}
              </p>
              <button
                onClick={resetImport}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif', fontSize: 11, marginTop: 6, padding: 0 }}
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function ProgressPanel({ progress }: { progress: ImportProgressEvent }) {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          Importing…
        </p>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>
          {progress.current} / {progress.total}
        </span>
      </div>
      <div style={{ height: 3, background: 'var(--border-default)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 300ms ease' }} />
      </div>
      <p style={{
        fontFamily: 'Syne, sans-serif', fontSize: 11,
        color: progress.status === 'failed' ? 'var(--destructive)' : 'var(--text-muted)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {progress.status === 'matching' && `Searching YouTube for "${progress.track_name}"…`}
        {progress.status === 'imported' && `Imported: ${progress.track_name}`}
        {progress.status === 'failed' && `Not found: ${progress.track_name}`}
      </p>
    </div>
  );
}

function ResultPanel({ result, onDismiss }: { result: ImportCompleteEvent; onDismiss: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--accent-haze)', border: '1px solid var(--accent)', borderRadius: 10, padding: '14px 16px' }}>
        <CheckCircle size={20} color="var(--accent)" weight="fill" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
            {result.imported === 0 && (result.already_present ?? 0) > 0
              ? 'Already up to date'
              : 'Import complete'}
          </p>
          <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {[
              result.imported > 0 && `${result.imported} new track${result.imported === 1 ? '' : 's'} added`,
              (result.already_present ?? 0) > 0 &&
                `${result.already_present} already in playlist`,
              result.failed > 0 && `${result.failed} not found on YouTube`,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          onClick={onDismiss}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif', fontSize: 11, flexShrink: 0 }}
        >
          Dismiss
        </button>
      </div>

      {}
      {result.truncated && (
        <div style={{
          background: 'rgba(255,180,60,0.08)',
          border: '1px solid rgba(255,180,60,0.35)',
          borderRadius: 10, padding: '12px 16px',
        }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 600, color: 'rgb(255,200,100)', marginBottom: 4 }}>
            Got the first {result.imported + result.failed}{result.spotify_total ? ` of ${result.spotify_total}` : ''} tracks
          </p>
          <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Spotify's public URL endpoint caps anonymous responses at ~100 tracks. To get the full playlist:
            <br />
            1. Go to <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>spotify.com/account/privacy</span> and request "Account data" (delivered in a few minutes).
            <br />
            2. Unzip the download, then drag <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>Playlist1.json</span> (or YourLibrary.json) onto the file-import box above.
          </p>
        </div>
      )}
    </div>
  );
}
