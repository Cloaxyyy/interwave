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
    <div className="iw-modal-backdrop" onClick={() => setOpen(false)}>
      <div className="iw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iw-modal-head">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Keyboard size={16} weight="duotone" />
            <span>Keyboard shortcuts</span>
          </h3>
          <button className="iw-x" aria-label="Close" onClick={() => setOpen(false)}>
            <X size={14} weight="bold" />
          </button>
        </div>
        <div className="iw-modal-body">
          {globalGroups.map((g) => (
            <div key={g.title}>
              <div className="iw-kb-section">{g.title}</div>
              {g.actions.map((id) => {
                const meta = ACTIONS.find((a) => a.id === id);
                if (!meta) return null;
                const combo = bindings[id] ?? DEFAULT_BINDINGS[id];
                return (
                  <div key={id} className="iw-kb-row">
                    <span className="iw-kb-lbl">{meta.label}</span>
                    <span className="iw-kb-keys">
                      {prettyKey(combo).map((k, i) => (
                        <kbd key={i} className="iw-kb-k">{k === 'Space' ? '␣' : k}</kbd>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="iw-kb-section">Overlays</div>
          <div className="iw-kb-row">
            <span className="iw-kb-lbl">This overlay</span>
            <span className="iw-kb-keys"><kbd className="iw-kb-k">?</kbd></span>
          </div>
          <div className="iw-kb-row">
            <span className="iw-kb-lbl">Close any modal</span>
            <span className="iw-kb-keys"><kbd className="iw-kb-k">Esc</kbd></span>
          </div>
          <p style={{
            marginTop: 16, fontSize: 11, color: 'var(--text-muted)',
            fontFamily: 'var(--sans)',
          }}>
            Customize bindings in Settings → Hotkeys.
          </p>
        </div>
      </div>
    </div>
  );
}
