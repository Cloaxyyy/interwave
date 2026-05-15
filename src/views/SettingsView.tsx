import { useState, useEffect } from 'react';
import { PageShell, PageHeader } from '../components/layout/PageShell';
import ImportView from './ImportView';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { setEqBand as setEqBandCmd, getEqBands, setEqPreset, listEqPresets, setCrossfade as setCrossfadeCmd, getCrossfade } from '../lib/tauri';
import { getDiagnostics, clearCrashLog, crashCount } from '../lib/crashReporter';

const APP_VERSION = '0.7.7';
import { usePlayerStore } from '../stores/playerStore';
import {
  ACTIONS, loadBindings, saveBindings, resetBindings,
  bindingFromEvent, prettyBinding, type HotkeyAction,
} from '../lib/hotkeys';
import {
  setGlobalHotkey, clearGlobalHotkey, getGlobalHotkeys, resetGlobalHotkeys,
} from '../lib/tauri';

type Section = 'account' | 'sound' | 'library' | 'shortcuts' | 'about';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'account',   label: 'Account & Privacy',   icon: '○' },
  { id: 'sound',     label: 'Sound',               icon: '▷' },
  { id: 'library',   label: 'Library & Import',    icon: '◫' },
  { id: 'shortcuts', label: 'Shortcuts',           icon: '⌘' },
  { id: 'about',     label: 'About',               icon: 'ⓘ' },
];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 38, height: 22, borderRadius: 999,
        background: on ? 'var(--accent)' : 'var(--bg-overlay)',
        position: 'relative', cursor: 'pointer',
        transition: 'background 160ms', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 18, height: 18, borderRadius: '50%',
        background: on ? 'var(--accent-ink)' : 'var(--text-muted)',
        transition: 'left 160ms, background 160ms',
      }}/>
    </div>
  );
}

function SettingRow({ name, sub, children }: { name: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 0', borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div>
        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--sans)' }}>{name}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, maxWidth: 420, lineHeight: 1.4, fontFamily: 'var(--sans)' }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function PlaybackSection() {
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem('interwave_autoplay') !== 'false');

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, margin: '0 0 4px', color: 'var(--text-primary)' }}>Playback</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 18, fontFamily: 'var(--sans)' }}>How tracks flow into one another.</p>
        <SettingRow name="Smooth gapless transitions" sub="Each track flows directly into the next with no silence between songs.">
          <Toggle on={true} onClick={() => {}}/>
        </SettingRow>
        <SettingRow name="Autoplay recommendations" sub="When the queue is empty, automatically continue with related songs.">
          <Toggle on={autoplay} onClick={() => {
            const next = !autoplay;
            setAutoplay(next);
            localStorage.setItem('interwave_autoplay', String(next));
          }}/>
        </SettingRow>
      </div>
    </div>
  );
}

function AudioSection() {
  const [hires, setHires] = useState(true);
  const [accentMode, setAccentMode] = useState<'auto' | 'pinned'>(() => {
    try { return localStorage.getItem('iw_accent_override') ? 'pinned' : 'auto'; } catch { return 'auto'; }
  });
  const [pinnedHue, setPinnedHue] = useState<number>(() => {
    try {
      const v = localStorage.getItem('iw_accent_hue');
      return v ? parseInt(v, 10) : 295;
    } catch { return 295; }
  });

  const applyAccent = (mode: 'auto' | 'pinned', hue: number) => {
    setAccentMode(mode);
    if (mode === 'pinned') {
      const css = `oklch(0.72 0.18 ${hue})`;
      try {
        localStorage.setItem('iw_accent_override', css);
        localStorage.setItem('iw_accent_hue', String(hue));
      } catch {}
      usePlayerStore.getState().setAccentColor(css);
    } else {
      try {
        localStorage.removeItem('iw_accent_override');
      } catch {}

      usePlayerStore.getState().setAccentColor('var(--accent)');
    }
  };

  return (
    <div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, margin: '0 0 4px', color: 'var(--text-primary)' }}>Audio quality</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 18, fontFamily: 'var(--sans)' }}>Choose fidelity. Lossless uses more bandwidth.</p>
      <SettingRow name="Streaming quality" sub="Currently streaming in 24-bit / 96 kHz FLAC.">
        <select
          defaultValue="hires"
          style={{
            background: 'var(--bg-elevated)', color: 'var(--text-primary)',
            border: '1px solid var(--border-default)', borderRadius: 6,
            padding: '6px 12px', fontSize: 13, cursor: 'pointer',
            fontFamily: 'var(--sans)',
          }}
        >
          <option value="low">Low · 96 kbps</option>
          <option value="med">Normal · 160 kbps</option>
          <option value="high">High · 320 kbps</option>
          <option value="lossless">Lossless · FLAC</option>
          <option value="hires">Hi-Res · 24-bit / 96kHz</option>
        </select>
      </SettingRow>
      <SettingRow name="Hi-Res on cellular" sub="Allow hi-res playback off Wi-Fi.">
        <Toggle on={hires} onClick={() => setHires(v => !v)}/>
      </SettingRow>

      {}
      <SettingRow
        name="Accent colour"
        sub={accentMode === 'auto'
          ? 'Auto — Interwave pulls a colour from the current album art on every track change.'
          : 'Pinned — the same accent colour everywhere, regardless of cover art.'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={accentMode}
            onChange={(e) => applyAccent(e.target.value as 'auto' | 'pinned', pinnedHue)}
            style={{
              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              border: '1px solid var(--border-default)', borderRadius: 6,
              padding: '6px 12px', fontSize: 12, cursor: 'pointer',
              fontFamily: 'var(--sans)',
            }}
          >
            <option value="auto">Auto from album art</option>
            <option value="pinned">Pinned</option>
          </select>
          {accentMode === 'pinned' && (
            <>
              <input
                type="range"
                min={0} max={359}
                value={pinnedHue}
                onChange={(e) => {
                  const h = parseInt(e.target.value, 10);
                  setPinnedHue(h);
                  applyAccent('pinned', h);
                }}
                style={{
                  width: 140, accentColor: `oklch(0.72 0.18 ${pinnedHue})`,
                  cursor: 'pointer',
                }}
              />
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: `oklch(0.72 0.18 ${pinnedHue})`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}/>
            </>
          )}
        </div>
      </SettingRow>

      <FsLyricsToggle/>
    </div>
  );
}

function FsLyricsToggle() {
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem('iw_show_fs_lyrics_btn') !== '0'; } catch { return true; }
  });
  const flip = () => {
    const next = !on;
    setOn(next);
    try { localStorage.setItem('iw_show_fs_lyrics_btn', next ? '1' : '0'); } catch {}
    window.dispatchEvent(new CustomEvent('iw:settings-changed'));
  };
  return (
    <SettingRow
      name="Fullscreen lyrics button"
      sub="The mic icon in the player bar that opens the karaoke-style fullscreen lyrics overlay. The mini-lyrics on the right panel always stay visible regardless."
    >
      <Toggle on={on} onClick={flip}/>
    </SettingRow>
  );
}

function PrivacySection() {
  const [tog, setTog] = useState({ analytics: false, presence: false, recs: true });
  const [count, setCount] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCount(crashCount());
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getDiagnostics(APP_VERSION));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const handleClear = () => {
    clearCrashLog();
    setCount(0);
  };

  return (
    <div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, margin: '0 0 4px', color: 'var(--text-primary)' }}>Privacy</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 18, fontFamily: 'var(--sans)' }}>Built in by default. These stay off unless you turn them on.</p>
      <SettingRow name="Anonymous usage analytics" sub="Help improve the app. Never tied to your listening history.">
        <Toggle on={tog.analytics} onClick={() => setTog(t => ({...t, analytics: !t.analytics}))}/>
      </SettingRow>
      <SettingRow name="Presence" sub="Let friends see what you're playing in real time.">
        <Toggle on={tog.presence} onClick={() => setTog(t => ({...t, presence: !t.presence}))}/>
      </SettingRow>
      <SettingRow name="Recommendations from history" sub="Use your recent plays to tailor weekly mixes.">
        <Toggle on={tog.recs} onClick={() => setTog(t => ({...t, recs: !t.recs}))}/>
      </SettingRow>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
          Diagnostics
        </div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, maxWidth: 460, lineHeight: 1.5 }}>
          {count === 0
            ? 'No crashes recorded. If you hit a bug, the app captures the error here so you can copy a report.'
            : `${count} ${count === 1 ? 'error' : 'errors'} captured locally. Copy them into a bug report if needed — never sent automatically.`}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleCopy}
            style={{
              padding: '7px 16px', borderRadius: 6,
              border: '1px solid var(--border-default)',
              background: copied ? 'rgba(200,255,87,0.1)' : 'transparent',
              color: copied ? 'var(--accent)' : 'var(--text-secondary)',
              fontFamily: 'var(--sans)', fontSize: 12, cursor: 'pointer',
              transition: 'all 120ms',
            }}
          >
            {copied ? '✓ Copied' : 'Copy diagnostics'}
          </button>
          {count > 0 && (
            <button
              onClick={handleClear}
              style={{
                padding: '7px 16px', borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontFamily: 'var(--sans)', fontSize: 12, cursor: 'pointer',
              }}
            >
              Clear log
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountSection() {
  const { user, displayName, setDisplayName, signOut } = useAuthStore();
  const [nameInput, setNameInput] = useState(displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveName = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('user_profiles')
      .update({ display_name: nameInput })
      .eq('id', user.id);
    if (!error) {
      setDisplayName(nameInput);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.reload();
  };

  return (
    <div>
      <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
        Account
      </h3>

      {!user ? (
        <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--sans)' }}>
            Not signed in.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontFamily: 'Syne, sans-serif' }}>Signed in as</p>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>{user.email}</p>
          </div>

          <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 8, fontFamily: 'Syne, sans-serif' }}>
              Display Name
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                style={{
                  flex: 1, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)', padding: '7px 10px', borderRadius: 6,
                  fontFamily: 'Syne, sans-serif', fontSize: 12, outline: 'none',
                }}
              />
              <button
                onClick={handleSaveName}
                disabled={saving}
                style={{
                  padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border-default)',
                  background: saved ? 'var(--success)' : 'var(--bg-overlay)',
                  color: saved ? '#000' : 'var(--text-primary)',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'Syne, sans-serif',
                }}
              >
                {saved ? 'Saved!' : saving ? '…' : 'Save'}
              </button>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-default)',
              background: 'transparent', color: 'var(--destructive)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Syne, sans-serif',
              textAlign: 'left',
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

type RowDef = {
  action: string;
  label: string;
  description: string;
  scope: 'in-app' | 'global';
};

const SHORTCUT_ROWS: RowDef[] = [

  ...ACTIONS.map((a) => ({
    action: a.id, label: a.label, description: a.description,
    scope: 'in-app' as const,
  })),

  { action: 'play-pause',  label: 'Play / Pause (global)',  description: 'Works even when another app or game is focused.', scope: 'global' },
  { action: 'skip-next',   label: 'Next track (global)',    description: 'System-wide skip-forward.', scope: 'global' },
  { action: 'skip-prev',   label: 'Previous track (global)', description: 'System-wide skip-back.', scope: 'global' },
  { action: 'volume-up',   label: 'Volume up (global)',     description: '+5%', scope: 'global' },
  { action: 'volume-down', label: 'Volume down (global)',   description: '-5%', scope: 'global' },
];

function bindingToGlobalCombo(b: string): string {

  return b.split('+').map((p) => {
    if (p === 'Ctrl' || p === 'Meta') return 'CommandOrControl';
    if (p === 'Shift') return 'Shift';
    if (p === 'Alt') return 'Alt';
    if (p.startsWith('Key')) return p.slice(3);
    if (p.startsWith('Digit')) return p.slice(5);
    if (p === 'ArrowUp') return 'Up';
    if (p === 'ArrowDown') return 'Down';
    if (p === 'ArrowLeft') return 'Left';
    if (p === 'ArrowRight') return 'Right';
    if (p === 'Space') return 'Space';
    return p;
  }).join('+');
}

function ShortcutsSection() {
  const [bindings, setBindings] = useState(() => loadBindings());
  const [globalBindings, setGlobalBindings] = useState<Record<string, string>>({});
  const [recordingFor, setRecordingFor] = useState<{ action: string; scope: 'in-app' | 'global' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGlobalHotkeys().then(setGlobalBindings).catch(() => {});
  }, []);

  useEffect(() => {
    if (!recordingFor) return;
    const onKey = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setRecordingFor(null); return; }
      const newBinding = bindingFromEvent(e);
      if (!newBinding) return;

      if (recordingFor.scope === 'in-app') {
        const next = { ...bindings, [recordingFor.action]: newBinding };
        setBindings(next);
        saveBindings(next);
        setRecordingFor(null);
        setError(null);
      } else {

        const combo = bindingToGlobalCombo(newBinding);
        try {
          await setGlobalHotkey(recordingFor.action, combo);
          setGlobalBindings((b) => ({ ...b, [recordingFor.action]: combo }));
          setRecordingFor(null);
          setError(null);
        } catch (err: any) {
          setError(typeof err === 'string' ? err : err?.message ?? 'Failed to register');
          setRecordingFor(null);
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recordingFor, bindings]);

  const resetAll = async () => {
    resetBindings();
    setBindings(loadBindings());
    try {
      const fresh = await resetGlobalHotkeys();
      setGlobalBindings(fresh);
    } catch {}
  };

  const clearGlobal = async (action: string) => {
    try {
      await clearGlobalHotkey(action);
      setGlobalBindings((b) => { const c = { ...b }; delete c[action]; return c; });
    } catch {}
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, margin: 0, color: 'var(--text-primary)' }}>
          Keyboard shortcuts
        </h3>
        <button onClick={resetAll} style={{
          background: 'transparent', border: '1px solid var(--border-default)',
          borderRadius: 6, padding: '4px 12px',
          fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}>
          Reset to defaults
        </button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16, fontFamily: 'var(--sans)' }}>
        Click any binding, then press the keys you want. Esc cancels. Saved automatically and survives restart.
      </p>
      {error && (
        <div style={{
          marginBottom: 12, padding: '8px 12px',
          background: 'rgba(255,68,68,0.10)', border: '1px solid rgba(255,68,68,0.3)',
          borderRadius: 6, color: 'var(--destructive)',
          fontFamily: 'var(--sans)', fontSize: 12,
        }}>
          {error}
        </div>
      )}

      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)', overflow: 'hidden',
      }}>
        {SHORTCUT_ROWS.map((row, i) => {
          const recording = recordingFor?.action === row.action && recordingFor?.scope === row.scope;
          const value = row.scope === 'in-app'
            ? bindings[row.action as HotkeyAction]
            : globalBindings[row.action];
          const display = value
            ? row.scope === 'in-app' ? prettyBinding(value) : value.replace(/CommandOrControl/, 'Ctrl').replace(/\+/g, ' + ')
            : 'Unbound';
          return (
            <div key={`${row.action}-${row.scope}`} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px',
              borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {row.label}
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 4,
                    background: row.scope === 'global' ? 'var(--accent-dim)' : 'var(--bg-overlay)',
                    color: row.scope === 'global' ? 'var(--accent)' : 'var(--text-muted)',
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                  }}>
                    {row.scope === 'global' ? 'GLOBAL' : 'IN-APP'}
                  </span>
                </div>
                <div style={{
                  fontFamily: 'var(--sans)', fontSize: 11,
                  color: 'var(--text-muted)', marginTop: 2,
                }}>
                  {row.description}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setRecordingFor({ action: row.action, scope: row.scope })}
                  style={{
                    fontFamily: 'var(--mono)', fontSize: 12,
                    color: recording ? 'var(--accent)' : 'var(--text-secondary)',
                    padding: '6px 12px',
                    background: recording ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                    border: `1px solid ${recording ? 'var(--accent)' : 'var(--border-default)'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    minWidth: 130, textAlign: 'center',
                  }}
                >
                  {recording ? 'Press keys…' : display}
                </button>
                {row.scope === 'global' && value && (
                  <button
                    onClick={() => clearGlobal(row.action)}
                    title="Unbind"
                    style={{
                      width: 28, height: 28,
                      background: 'transparent', border: '1px solid var(--border-default)',
                      borderRadius: 6, cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: 12,
                      display: 'grid', placeItems: 'center',
                    }}
                  >×</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 14, color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--sans)' }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Global hotkeys</strong> register with the operating system, so they fire even
        when another app or fullscreen game is in focus. If a combo says it failed
        to register, another running app probably claimed it first.
      </p>
    </div>
  );
}

function AboutSection() {
  return (
    <div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, margin: '0 0 4px', color: 'var(--text-primary)' }}>About Interwave</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24, fontFamily: 'var(--sans)' }}>A music player built around the music.</p>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-lg)', padding: '24px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
      }}>
        {[
          ['Version', '1.2.0'],
          ['Build', 'Tauri 2 · Rust · React 19'],
          ['Audio', 'rodio 0.18 · symphonia'],
          ['Database', 'SQLite (local, encrypted)'],
          ['Data collection', 'None. Ever.'],
          ['Source', 'github.com/interwave'],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const EQ_BAND_NAMES = ['Sub', 'Bass', 'Mid', 'Hi-Mid', 'Air'];
const EQ_BAND_FREQS = ['60 Hz', '250 Hz', '1 kHz', '4 kHz', '8 kHz'];

function EqualizerSection() {
  const eqBands = usePlayerStore((s) => s.eqBands);
  const setEqBandStore = usePlayerStore((s) => s.setEqBand);
  const [localBands, setLocalBands] = useState<number[]>(eqBands);
  const [presets, setPresets] = useState<string[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [crossfade, setCrossfade] = useState<number>(0);

  useEffect(() => {
    getEqBands()
      .then((bands) => {
        setLocalBands(bands);
        bands.forEach((db, i) => setEqBandStore(i, db));
      })
      .catch(() => {});
    listEqPresets().then(setPresets).catch(() => {});
    getCrossfade().then(setCrossfade).catch(() => {});

  }, []);

  const handleBandChange = (band: number, db: number) => {
    const next = [...localBands];
    next[band] = db;
    setLocalBands(next);
    setEqBandStore(band, db);
    setEqBandCmd(band, db).catch(() => {});
    setActivePreset(null);
  };

  const handleReset = () => {
    const zeros = [0, 0, 0, 0, 0];
    setLocalBands(zeros);
    zeros.forEach((db, i) => {
      setEqBandStore(i, db);
      setEqBandCmd(i, db).catch(() => {});
    });
    setActivePreset('Flat');
  };

  const handlePreset = (name: string) => {
    setEqPreset(name)
      .then((bands) => {
        setLocalBands(bands);
        bands.forEach((db, i) => setEqBandStore(i, db));
        setActivePreset(name);
      })
      .catch(() => {});
  };

  const handleCrossfade = (secs: number) => {
    setCrossfade(secs);
    setCrossfadeCmd(secs).catch(() => {});
  };

  const formatDb = (db: number) => {
    if (db === 0) return '0 dB';
    return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
  };

  return (
    <div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, margin: '0 0 4px', color: 'var(--text-primary)' }}>Equalizer</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 18, fontFamily: 'var(--sans)' }}>
        Boost or cut each frequency band by up to ±12 dB. Changes apply live to the audio pipeline.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
        {presets.map((name) => {
          const active = activePreset === name;
          return (
            <button
              key={name}
              onClick={() => handlePreset(name)}
              style={{
                padding: '5px 12px',
                borderRadius: 999,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
                background: active ? 'rgba(200,255,87,0.1)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontFamily: 'var(--sans)',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 120ms',
              }}
            >
              {name}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 16 }}>
        {EQ_BAND_NAMES.map((name, i) => {
          const db = localBands[i] ?? 0;
          return (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
              {}
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 11,
                color: db !== 0 ? 'var(--accent)' : 'var(--text-muted)',
                minWidth: 52, textAlign: 'center',
                transition: 'color 120ms',
              }}>
                {formatDb(db)}
              </div>

              {}
              <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={db}
                  onChange={(e) => handleBandChange(i, parseFloat(e.target.value))}
                  style={{
                    width: 120,
                    height: 4,
                    transform: 'rotate(-90deg)',
                    cursor: 'pointer',
                    accentColor: 'var(--accent)',
                  }}
                />
              </div>

              {}
              <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{name}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)' }}>{EQ_BAND_FREQS[i]}</div>
            </div>
          );
        })}
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 20 }}/>

      <button
        onClick={handleReset}
        style={{
          padding: '7px 18px', borderRadius: 6,
          border: '1px solid var(--border-default)',
          background: 'transparent', color: 'var(--text-secondary)',
          fontFamily: 'var(--sans)', fontSize: 13, cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        Reset EQ
      </button>

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '32px 0 24px' }}/>

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, margin: '0 0 4px', color: 'var(--text-primary)' }}>Crossfade</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 18, fontFamily: 'var(--sans)' }}>
        Smoothly fade out the previous track when a new one starts. 0 disables.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, maxWidth: 460 }}>
        <input
          type="range"
          min={0}
          max={12}
          step={0.5}
          value={crossfade}
          onChange={(e) => handleCrossfade(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 12,
          color: crossfade > 0 ? 'var(--accent)' : 'var(--text-muted)',
          minWidth: 48, textAlign: 'right',
        }}>
          {crossfade > 0 ? `${crossfade.toFixed(1)} s` : 'Off'}
        </span>
      </div>
    </div>
  );
}

function renderSection(section: Section) {
  switch (section) {
    case 'account':
      return (
        <>
          <AccountSection/>
          <div style={{ height: 32 }} />
          <PrivacySection/>
        </>
      );
    case 'sound':
      return (
        <>
          <PlaybackSection/>
          <div style={{ height: 32 }} />
          <AudioSection/>
          <div style={{ height: 32 }} />
          <EqualizerSection/>
        </>
      );
    case 'library':
      return <ImportView/>;
    case 'shortcuts':
      return <ShortcutsSection/>;
    case 'about':
      return <AboutSection/>;
  }
}

export default function SettingsView() {
  const [section, setSection] = useState<Section>('sound');

  return (
    <PageShell>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 40 }}>
        {}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SECTIONS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              style={{
                textAlign: 'left', padding: '9px 14px', borderRadius: 'var(--r-sm)',
                background: section === id ? 'var(--bg-surface)' : 'transparent',
                color: section === id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontFamily: 'var(--sans)', fontSize: 13, border: 'none', cursor: 'pointer',
                transition: 'background 160ms, color 160ms',
                display: 'flex', alignItems: 'center', gap: 10,
              }}
              onMouseEnter={e => { if (section !== id) e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { if (section !== id) e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: 14, opacity: 0.7 }}>{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        {}
        <div>{renderSection(section)}</div>
      </div>
    </PageShell>
  );
}
