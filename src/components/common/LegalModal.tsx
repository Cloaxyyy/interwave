import { useEffect } from 'react';
import { X } from '@phosphor-icons/react';
import privacyMd from '../../legal/privacy.md?raw';
import termsMd from '../../legal/terms.md?raw';

export type LegalDoc = 'privacy' | 'terms';

interface Props {
  doc: LegalDoc;
  onClose: () => void;
}

function renderMarkdown(src: string) {
  const blocks: React.ReactNode[] = [];
  const lines = src.split('\n');
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('# ')) {
      blocks.push(
        <h1 key={key++} style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
          {line.slice(2)}
        </h1>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h2 key={key++} style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 18, marginBottom: 6 }}>
          {line.slice(3)}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} style={{ paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.6, marginBottom: 8 }}>
          {items.map((it, j) => <li key={j} style={{ marginBottom: 3 }}>{renderInline(it)}</li>)}
        </ul>
      );
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (line.startsWith('_') && line.endsWith('_')) {
      blocks.push(
        <p key={key++} style={{ color: 'var(--text-muted)', fontSize: 11, fontStyle: 'italic', marginBottom: 12 }}>
          {line.slice(1, -1)}
        </p>
      );
      i++;
      continue;
    }
    blocks.push(
      <p key={key++} style={{ color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.6, marginBottom: 8 }}>
        {renderInline(line)}
      </p>
    );
    i++;
  }
  return blocks;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={key++} style={{ color: 'var(--text-primary)' }}>{m[1]}</strong>);
    else if (m[2]) parts.push(<a key={key++} href={m[3]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{m[2]}</a>);
    else if (m[4]) parts.push(<code key={key++} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 3 }}>{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function LegalModal({ doc, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const src = doc === 'privacy' ? privacyMd : termsMd;
  const title = doc === 'privacy' ? 'Privacy Policy' : 'Terms of Service';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 100%)',
          maxHeight: '85vh',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            {title.toUpperCase()}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px 24px' }}>
          {renderMarkdown(src)}
        </div>
      </div>
    </div>
  );
}
