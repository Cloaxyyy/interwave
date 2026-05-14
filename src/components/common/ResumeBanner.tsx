// Resume banner — appears on launch if the previous session has a saved track.

import { useEffect, useState } from 'react';
import { ArrowCounterClockwise, X } from '@phosphor-icons/react';
import { loadResumeState, clearResumeState, type ResumeState } from '../../lib/crashResume';
import { playTrack, seek } from '../../lib/tauri';
import { usePlayerStore } from '../../stores/playerStore';

export default function ResumeBanner() {
  const [state, setState] = useState<ResumeState | null>(null);
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  useEffect(() => {
    setState(loadResumeState());
  }, []);

  // If a track started playing for any reason, hide the banner.
  useEffect(() => {
    if (currentTrack) setState(null);
  }, [currentTrack]);

  if (!state) return null;

  const { track, position } = state;
  const mins = Math.floor(position / 60);
  const secs = Math.floor(position % 60).toString().padStart(2, '0');

  const resume = async () => {
    try {
      await playTrack({
        video_id: track.youtube_id,
        title: track.title,
        artist: track.artist,
        duration_seconds: track.duration_seconds,
        thumbnail_url: track.thumbnail_url,
      });
      // Wait a beat for the track to actually start, then seek.
      setTimeout(() => seek(position).catch(() => {}), 1500);
    } catch (e) { console.error('[resume] playTrack failed:', e); }
    finally { clearResumeState(); setState(null); }
  };

  const dismiss = () => { clearResumeState(); setState(null); };

  return (
    <div style={{
      position: 'fixed',
      bottom: 110, left: 22,
      zIndex: 8000,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 14,
      boxShadow: 'var(--shadow-lg)',
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      maxWidth: 360,
      animation: 'iw-resume-in 320ms cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <style>{`
        @keyframes iw-resume-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {track.thumbnail_url ? (
        <img src={track.thumbnail_url} alt="" draggable={false}
          style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}/>
      ) : (
        <div style={{
          width: 40, height: 40, borderRadius: 6, flexShrink: 0,
          background: 'var(--bg-overlay)',
          display: 'grid', placeItems: 'center',
          color: 'var(--text-muted)',
        }}>♪</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Pick up where you left off
        </p>
        <p style={{
          fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700,
          color: 'var(--text-primary)', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {track.title}
        </p>
        <p style={{
          fontFamily: 'var(--sans)', fontSize: 10,
          color: 'var(--text-muted)', marginTop: 2,
        }}>
          {track.artist} · paused at {mins}:{secs}
        </p>
      </div>
      <button
        onClick={resume}
        style={{
          background: 'var(--accent)', color: 'var(--accent-ink)',
          border: 'none', borderRadius: 8,
          padding: '7px 12px', cursor: 'pointer',
          fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 5,
          flexShrink: 0,
        }}
      >
        <ArrowCounterClockwise size={12} weight="bold"/>
        Resume
      </button>
      <button
        onClick={dismiss}
        title="Don't ask again"
        style={{
          width: 22, height: 22,
          background: 'transparent', border: 'none',
          color: 'var(--text-muted)', cursor: 'pointer',
          display: 'grid', placeItems: 'center',
          flexShrink: 0,
        }}
      ><X size={11} weight="bold"/></button>
    </div>
  );
}
