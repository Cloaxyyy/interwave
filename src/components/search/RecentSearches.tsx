import { useState } from 'react';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import { clearSearchHistory } from '../../lib/tauri';
import { useSearchStore } from '../../stores/searchStore';

interface RecentSearchesProps {
  onSelect: (query: string) => void;
}

export default function RecentSearches({ onSelect }: RecentSearchesProps) {
  const { recentSearches, setRecentSearches } = useSearchStore();

  const handleClear = async () => {
    try {
      await clearSearchHistory();
      setRecentSearches([]);
    } catch (err) {
      console.error('[RecentSearches] clear failed:', err);
    }
  };

  const handleSelect = (q: string) => {
    onSelect(q);
  };

  if (recentSearches.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'Syne' }}>
          Search for music on YouTube
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            fontFamily: 'Syne',
          }}
        >
          RECENT SEARCHES
        </span>
        <button
          onClick={handleClear}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 11,
            fontFamily: 'Syne',
            padding: '2px 4px',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--destructive)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)')}
        >
          Clear
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {recentSearches.map((q) => (
          <RecentChip key={q} query={q} onSelect={handleSelect} />
        ))}
      </div>
    </div>
  );
}

function RecentChip({ query, onSelect }: { query: string; onSelect: (q: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => onSelect(query)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        borderRadius: 20,
        border: '1px solid var(--border-default)',
        background: hovered ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontFamily: 'Syne, sans-serif',
        fontSize: 12,
        cursor: 'pointer',
        transition: 'background 120ms, color 120ms',
      }}
    >
      <ClockCounterClockwise size={12} weight="bold" />
      {query}
    </button>
  );
}
