// In-app hotkey config. Format: "Modifier+Modifier+KeyboardEvent.code".

export type HotkeyAction =
  | 'play-pause'
  | 'skip-next'
  | 'skip-prev'
  | 'seek-forward'
  | 'seek-back'
  | 'volume-up'
  | 'volume-down'
  | 'mute'
  | 'palette';

export interface ActionMeta {
  id: HotkeyAction;
  label: string;
  description: string;
}

export const ACTIONS: ActionMeta[] = [
  { id: 'play-pause',   label: 'Play / Pause',     description: 'Toggle playback for the current track.' },
  { id: 'skip-next',    label: 'Next track',       description: 'Skip to the next track in the queue.' },
  { id: 'skip-prev',    label: 'Previous track',   description: 'Skip back to the previous track (or restart current if past 3 s).' },
  { id: 'seek-forward', label: 'Seek +10 s',       description: 'Jump 10 seconds ahead in the current track.' },
  { id: 'seek-back',    label: 'Seek −10 s',       description: 'Jump 10 seconds backward in the current track.' },
  { id: 'volume-up',    label: 'Volume up',        description: 'Increase volume by 5%.' },
  { id: 'volume-down',  label: 'Volume down',      description: 'Decrease volume by 5%.' },
  { id: 'mute',         label: 'Mute / Unmute',    description: 'Toggle volume between 0 and your previous level.' },
  { id: 'palette',      label: 'Command palette',  description: 'Open the universal jump-to overlay.' },
];

export const DEFAULT_BINDINGS: Record<HotkeyAction, string> = {
  'play-pause':   'Space',
  'skip-next':    'KeyN',
  'skip-prev':    'KeyP',
  'seek-forward': 'ArrowRight',
  'seek-back':    'ArrowLeft',
  'volume-up':    'ArrowUp',
  'volume-down':  'ArrowDown',
  'mute':         'KeyM',
  'palette':      'Ctrl+KeyK',
};

const STORAGE_KEY = 'iw_hotkeys_v1';

export function loadBindings(): Record<HotkeyAction, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BINDINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_BINDINGS, ...parsed };
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

export function saveBindings(b: Record<HotkeyAction, string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)); } catch {}
  window.dispatchEvent(new CustomEvent('iw:hotkeys-updated'));
}

export function resetBindings() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  window.dispatchEvent(new CustomEvent('iw:hotkeys-updated'));
}

/** Compose a normalised binding string from a KeyboardEvent. */
export function bindingFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey)  parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey)   parts.push('Alt');
  if (e.metaKey)  parts.push('Meta');
  // Skip pure modifier key presses
  if (e.code === 'ControlLeft' || e.code === 'ControlRight'
      || e.code === 'ShiftLeft' || e.code === 'ShiftRight'
      || e.code === 'AltLeft' || e.code === 'AltRight'
      || e.code === 'MetaLeft' || e.code === 'MetaRight') {
    return '';
  }
  parts.push(e.code);
  return parts.join('+');
}

/** Test whether a KeyboardEvent matches a given binding string. */
export function matchesBinding(e: KeyboardEvent, binding: string): boolean {
  if (!binding) return false;
  return bindingFromEvent(e) === binding;
}

/** Pretty-print a binding for the UI. e.g. "Ctrl+KeyK" → "Ctrl + K" */
export function prettyBinding(b: string): string {
  if (!b) return '—';
  const map: Record<string, string> = {
    'Shift': '⇧', 'Meta': '⌘',
    'ArrowUp': '↑', 'ArrowDown': '↓',
    'ArrowLeft': '←', 'ArrowRight': '→',
  };
  return b
    .split('+')
    .map((p) => map[p] ?? p.replace(/^Key/, '').replace(/^Digit/, ''))
    .join(' + ');
}
