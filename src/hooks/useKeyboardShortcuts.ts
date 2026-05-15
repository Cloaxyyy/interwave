import { useEffect, useRef, useState } from 'react';
import { pause, resume, seek, setVolume, skipNext, skipPrev } from '../lib/tauri';
import { usePlayerStore } from '../stores/playerStore';
import {
  loadBindings, matchesBinding,
  type HotkeyAction,
} from '../lib/hotkeys';

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts() {
  const lastVolumeRef = useRef<number>(0.8);

  const [bindings, setBindings] = useState(() => loadBindings());

  useEffect(() => {
    const onUpdate = () => setBindings(loadBindings());
    window.addEventListener('iw:hotkeys-updated', onUpdate);
    return () => window.removeEventListener('iw:hotkeys-updated', onUpdate);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      const matched = (Object.entries(bindings) as Array<[HotkeyAction, string]>)
        .find(([, b]) => matchesBinding(e, b));
      if (!matched) return;

      const [action] = matched;
      e.preventDefault();

      const { playbackState, position, volume } = usePlayerStore.getState();

      switch (action) {
        case 'play-pause':
          if (playbackState === 'playing') pause().catch(console.error);
          else if (
            playbackState === 'paused' ||
            playbackState === 'stopped' ||
            playbackState === 'ended'
          ) resume().catch(console.error);
          break;
        case 'skip-next':
          skipNext().catch(console.error);
          break;
        case 'skip-prev':
          skipPrev().catch(console.error);
          break;
        case 'seek-forward':
          seek(Math.max(0, position + 10)).catch(console.error);
          break;
        case 'seek-back':
          seek(Math.max(0, position - 10)).catch(console.error);
          break;
        case 'volume-up': {
          const v = Math.min(1, volume + 0.05);
          setVolume(v).catch(console.error);
          usePlayerStore.getState().setVolume(v);
          break;
        }
        case 'volume-down': {
          const v = Math.max(0, volume - 0.05);
          setVolume(v).catch(console.error);
          usePlayerStore.getState().setVolume(v);
          break;
        }
        case 'mute': {
          const cur = usePlayerStore.getState().volume;
          if (cur === 0) {
            const restored = lastVolumeRef.current > 0 ? lastVolumeRef.current : 0.8;
            setVolume(restored).catch(console.error);
            usePlayerStore.getState().setVolume(restored);
          } else {
            lastVolumeRef.current = cur;
            setVolume(0).catch(console.error);
            usePlayerStore.getState().setVolume(0);
          }
          break;
        }
        case 'palette':

          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }));
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bindings]);
}
