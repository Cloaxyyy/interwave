import { useState } from 'react';
import bannerLogo from '../../assets/interwave-banner-dark.svg';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, MagnifyingGlass } from '@phosphor-icons/react';
import { useUiStore } from '../../stores/uiStore';

const appWindow = getCurrentWindow();

interface WinBtnProps {
  icon: React.ReactNode;
  action: () => void;
  label: string;
  danger?: boolean;
}

function WindowButton({ icon, action, label, danger = false }: WinBtnProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={action}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 32, height: 28,
        display: 'grid', placeItems: 'center',
        background: hovered
          ? danger ? 'rgba(255,68,68,0.20)' : 'var(--bg-elevated)'
          : 'transparent',
        border: 'none',
        borderRadius: 6,
        color: danger
          ? hovered ? 'var(--destructive)' : 'var(--text-muted)'
          : hovered ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'background 150ms, color 150ms',
      }}
    >
      {icon}
    </button>
  );
}

// Central pill that mimics Spotify's "What do you want to listen to?" but
// also doubles as the discoverability hint for the ⌘K command palette.
function CmdKHint() {
  const [hovered, setHovered] = useState(false);
  // Open the palette by dispatching a synthetic Cmd+K
  const trigger = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }));
  };
  return (
    <button
      onClick={trigger}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 30, padding: '0 14px 0 12px',
        background: hovered ? 'var(--bg-overlay)' : 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 999,
        color: 'var(--text-muted)',
        cursor: 'pointer',
        fontFamily: 'var(--sans)',
        fontSize: 12,
        transition: 'background 160ms, border-color 160ms, color 160ms',
        minWidth: 280,
      }}
    >
      <MagnifyingGlass size={13} weight="bold" />
      <span style={{ flex: 1, textAlign: 'left' }}>
        {hovered ? 'Search anything' : 'What do you want to listen to?'}
      </span>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10,
        background: 'var(--bg-base)', border: '1px solid var(--border-default)',
        borderRadius: 4, padding: '1px 6px',
        color: 'var(--text-secondary)',
      }}>
        ⌘K
      </span>
    </button>
  );
}

export default function Titlebar() {
  const setActiveView = useUiStore((s) => s.setActiveView);

  return (
    <div
      data-tauri-drag-region
      style={{
        height: 48,
        // Mirrors the player bar's tint so the app's top and bottom chrome
        // share the same atmosphere — frames the content rather than
        // floating disconnected colors.
        background: 'linear-gradient(180deg, var(--tint-12) 0%, var(--tint-4) 100%)',
        borderBottom: '1px solid var(--seam)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 12,
        flexShrink: 0,
        userSelect: 'none',
        transition: 'background 600ms ease, border-color 600ms ease',
      }}
    >
      {/* Logo */}
      <div
        onClick={() => setActiveView('home')}
        style={{ cursor: 'pointer', padding: '0 8px', display: 'flex', alignItems: 'center' }}
      >
        <img
          src={bannerLogo}
          alt="Interwave"
          draggable={false}
          style={{ height: 22, display: 'block' }}
        />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} data-tauri-drag-region />

      {/* Cmd+K hint pill */}
      <div onMouseDown={(e) => e.stopPropagation()}>
        <CmdKHint />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} data-tauri-drag-region />

      {/* Window controls */}
      <div style={{ display: 'flex', gap: 4 }} onMouseDown={(e) => e.stopPropagation()}>
        <WindowButton icon={<Minus size={13} weight="bold" />} action={() => appWindow.minimize()} label="Minimize" />
        <WindowButton icon={<Square size={11} weight="bold" />} action={() => appWindow.toggleMaximize()} label="Maximize" />
        <WindowButton icon={<X size={13} weight="bold" />} action={() => appWindow.close()} label="Close" danger />
      </div>
    </div>
  );
}
