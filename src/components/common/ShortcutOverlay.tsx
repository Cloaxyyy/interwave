import { useEffect, useState } from 'react';
import { X, Keyboard } from '@phosphor-icons/react';
import { ACTIONS, DEFAULT_BINDINGS, loadBindings, type HotkeyAction } from '../../lib/hotkeys';

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

function prettyKey(combo: string): string[] {
  return combo
    .replace(/Key/g, '')
    .replace(/Arrow/g, '')
    .replace(/Ctrl/g, '⌃')
    .replace(/Meta/g, '⌘')
    .replace(/Shift/g, '⇧')
    .replace(/Alt/g, '⌥')
    .split('+');
}

export default function ShortcutOverlay() {
  const [open, setOpen] = useState(false);
  const [bindings, setBindings] = useState(() => loadBindings());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !isInputFocused()) {
        e.preventDefault();
        setOpen((o) => !o);
        setBindings(loadBindings());
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const globalGroups = [
    { title: 'Playback', actions: ['play-pause', 'skip-next', 'skip-prev', 'seek-forward', 'seek-back'] as HotkeyAction[] },
    { title: 'Volume', actions: ['volume-up', 'volume-down', 'mute'] as HotkeyAction[] },
    { title: 'Navigation', actions: ['palette'] as HotkeyAction[] },
  ];

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)', maxHeight: '85vh',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-default)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            <Keyboard size={16} weight="duotone" /> KEYBOARD SHORTCUTS
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px 20px 20px' }}>
          {globalGroups.map((g) => (
            <div key={g.title} style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>
                {g.title.toUpperCase()}
              </div>
              {g.actions.map((id) => {
                const meta = ACTIONS.find((a) => a.id === id);
                if (!meta) return null;
                const combo = bindings[id] ?? DEFAULT_BINDINGS[id];
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--sans)' }}>{meta.label}</span>
                    <span style={{ display: 'flex', gap: 4 }}>
                      {prettyKey(combo).map((k, i) => (
                        <kbd key={i} style={{
                          fontFamily: 'var(--mono)', fontSize: 11, padding: '2px 7px',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 4, color: 'var(--text-secondary)',
                          minWidth: 20, textAlign: 'center',
                        }}>
                          {k === 'Space' ? '␣' : k}
                        </kbd>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>OVERLAYS</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--sans)' }}>This overlay</span>
              <kbd style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '2px 7px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 4, color: 'var(--text-secondary)' }}>?</kbd>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--sans)' }}>Close any modal</span>
              <kbd style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '2px 7px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 4, color: 'var(--text-secondary)' }}>Esc</kbd>
            </div>
          </div>
          <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--sans)' }}>
            Customize bindings in Settings → Hotkeys.
          </p>
        </div>
      </div>
    </div>
  );
}
