import { useRef, useState } from 'react';
import { MusicNote, Queue, X, DotsSixVertical } from '@phosphor-icons/react';
import { usePlayerStore } from '../stores/playerStore';
import { clearQueue, skipNext, setQueue } from '../lib/tauri';
import type { Track } from '../lib/tauri';

function formatDuration(s: number | null) {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface QueueTrackRowProps {
  track: Track;
  index: number;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  dropIndex: number | null;
  dragIndex: number | null;
}

function QueueTrackRow({
  track,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dropIndex,
  dragIndex,
}: QueueTrackRowProps) {
  const [hovered, setHovered] = useState(false);

  const isDragging = dragIndex === index;
  const showLineAbove = dropIndex === index && dragIndex !== null && dragIndex !== index && dragIndex !== index - 1;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '7px 16px',
        borderRadius: 6,
        transition: 'background 120ms, opacity 120ms',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.4 : 1,
        background: hovered && !isDragging ? 'var(--bg-elevated)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {}
      {showLineAbove && (
        <div
          style={{
            position: 'absolute',
            top: -1,
            left: 8,
            right: 8,
            height: 2,
            borderRadius: 1,
            background: 'var(--accent)',
            pointerEvents: 'none',
          }}
        />
      )}

      {}
      <span style={{ width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        {hovered ? (
          <DotsSixVertical size={14} color="var(--text-muted)" style={{ cursor: 'grab' }} />
        ) : (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>
            {index + 1}
          </span>
        )}
      </span>

      {}
      <div style={{ width: 36, height: 36, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-overlay)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {track.thumbnail_url
          ? <img src={track.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
          : <MusicNote size={14} weight="duotone" color="var(--text-muted)" />}
      </div>

      {}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.title}
        </p>
        <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: 'var(--text-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.artist}
        </p>
      </div>

      {}
      {track.duration_seconds && (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
          {formatDuration(track.duration_seconds)}
        </span>
      )}
    </div>
  );
}

export default function QueueView() {
  const { currentTrack, queue, playbackState } = usePlayerStore();
  const setQueueLocal = usePlayerStore((s) => s.setQueue);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const handleClear = () => clearQueue().catch(console.error);
  const handleSkip = () => skipNext().catch(console.error);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
    dragIndexRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(index);
  };

  const handleDrop = (_e: React.DragEvent, targetIndex: number) => {
    const from = dragIndexRef.current;
    if (from === null || from === targetIndex) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }

    const reordered = [...queue];
    const [item] = reordered.splice(from, 1);
    reordered.splice(targetIndex, 0, item);

    setQueueLocal(reordered);

    setQueue(reordered).catch(console.error);

    setDragIndex(null);
    setDropIndex(null);
    dragIndexRef.current = null;
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
    dragIndexRef.current = null;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {}
      <div style={{ padding: '16px 20px 8px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Queue{queue.length > 0 && ` · ${queue.length} track${queue.length !== 1 ? 's' : ''}`}
        </h2>
        {queue.length > 0 && (
          <button
            onClick={handleClear}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 4 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--destructive)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
          >
            <X size={12} weight="bold" /> Clear
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px' }}>
        {}
        {currentTrack && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '0 16px 6px' }}>NOW PLAYING</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 16px', borderRadius: 6, background: 'var(--accent-dim)', margin: '0 4px' }}>
              <Queue size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
              <div style={{ width: 36, height: 36, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-overlay)', flexShrink: 0 }}>
                {currentTrack.thumbnail_url
                  ? <img src={currentTrack.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MusicNote size={14} color="var(--text-muted)" /></div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentTrack.title}
                </p>
                <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: 'var(--text-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentTrack.artist}
                </p>
              </div>
              <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, color: 'var(--accent)', flexShrink: 0, background: 'var(--accent-dim)', padding: '2px 6px', borderRadius: 3 }}>
                {playbackState === 'playing' ? '▶' : playbackState === 'paused' ? '⏸' : '···'}
              </span>
            </div>
          </div>
        )}

        {}
        {queue.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 6px' }}>
              <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>UP NEXT</p>
              <button
                onClick={handleSkip}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif', fontSize: 10, padding: '2px 6px', borderRadius: 3 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
              >
                Skip to next →
              </button>
            </div>
            {queue.map((track, i) => (
              <QueueTrackRow
                key={`${track.id}-${i}`}
                track={track}
                index={i}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                dropIndex={dropIndex}
                dragIndex={dragIndex}
              />
            ))}
          </>
        )}

        {}
        {!currentTrack && queue.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12 }}>
            <Queue size={32} color="var(--text-muted)" weight="duotone" />
            <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--text-muted)' }}>
              Nothing in queue
            </p>
            <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: 'var(--text-muted)', maxWidth: 220, textAlign: 'center' }}>
              Play a song from a playlist or your library to auto-queue the rest.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
