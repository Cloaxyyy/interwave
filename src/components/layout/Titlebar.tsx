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

function CmdKHint() {
  const [hovered, setHovered] = useState(false);

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

        background: `
          linear-gradient(180deg,
            color-mix(in oklch, var(--accent-live) 10%, var(--bg-surface)) 0%,
            color-mix(in oklch, var(--accent-live) 5%, var(--bg-surface)) 100%
          )
        `,
        borderBottom: 'none',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 12,
        flexShrink: 0,
        userSelect: 'none',
        transition: 'background 600ms ease, border-color 600ms ease',
      }}
    >
      {}
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

      {}
      <div style={{ flex: 1 }} data-tauri-drag-region />

      {}
      <div onMouseDown={(e) => e.stopPropagation()}>
        <CmdKHint />
      </div>

      {}
      <div style={{ flex: 1 }} data-tauri-drag-region />

      {}
      <div style={{ display: 'flex', gap: 4 }} onMouseDown={(e) => e.stopPropagation()}>
        <WindowButton icon={<Minus size={13} weight="bold" />} action={() => appWindow.minimize()} label="Minimize" />
        <WindowButton icon={<Square size={11} weight="bold" />} action={() => appWindow.toggleMaximize()} label="Maximize" />
        <WindowButton icon={<X size={13} weight="bold" />} action={() => appWindow.close()} label="Close" danger />
      </div>
    </div>
  );
}
