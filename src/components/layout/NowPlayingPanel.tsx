import { useState, useEffect } from 'react';
import { HeartStraight, MicrophoneStage } from '@phosphor-icons/react';
import { usePlayerStore } from '../../stores/playerStore';
import { useUiStore } from '../../stores/uiStore';
import { likeTrack, unlikeTrack, playTrack, addToQueue } from '../../lib/tauri';
import { toast } from '../../stores/toastStore';
import { cleanTrackTitle } from '../../lib/cleanTitle';
import AlbumArt from '../player/AlbumArt';
import SoundWaveIcon from '../player/SoundWaveIcon';
import PlaybackControls from '../player/PlaybackControls';
import MiniLyrics from '../player/MiniLyrics';

const HANDLE_WIDTH = 6; // grab-zone for resize

export default function NowPlayingPanel() {
  const { currentTrack, playbackState, setCurrentTrack, recommendations } = usePlayerStore();
  const { rightPanelWidth, setRightPanelWidth, bumpLibraryVersion, setLyricsFullscreen } = useUiStore();
  const isPlaying = playbackState === 'playing';
  const [handleHover, setHandleHover] = useState(false);
  const [resizing, setResizing] = useState(false);

  // Drag-to-resize: mouse-down on the left edge starts a global mousemove
  // listener that updates the width until mouseup. The drag handle is
  // invisible until hovered, so it never gets in the user's way — but
  // the cursor still flips to ew-resize when you approach the edge.
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth - e.clientX;
      setRightPanelWidth(w);
    };
    const onUp = () => setResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing, setRightPanelWidth]);

  const handleLike = async () => {
    if (!currentTrack) return;
    const track = currentTrack;
    try {
      if (track.liked) {
        await unlikeTrack(track.id);
        toast.info('Removed from Liked Songs');
      } else {
        await likeTrack(track.id);
        toast.success('Added to Liked Songs', track.title);
      }
      if (usePlayerStore.getState().currentTrack?.id === track.id) {
        setCurrentTrack({ ...track, liked: !track.liked });
      }
      bumpLibraryVersion();
    } catch (err) {
      console.error('[NowPlayingPanel] like/unlike failed:', err);
      toast.error('Could not save', 'Try again in a moment.');
    }
  };

  return (
    <aside
      style={{
        width: rightPanelWidth,
        background: `
          linear-gradient(180deg, var(--tint-18) 0%, var(--tint-4) 60%)
        `,
        borderLeft: '1px solid var(--seam)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
        transition: resizing ? 'none' : 'background 600ms ease, border-color 600ms ease',
      }}
    >
      {/* ── Hover-to-show drag handle on the LEFT EDGE ───────────────────
           Default: invisible 6px hot-zone with ew-resize cursor.
           Hover: a 2px accent line fades in (Spotify-style).
           MouseDown anywhere in this strip starts the drag. */}
      <div
        onMouseEnter={() => setHandleHover(true)}
        onMouseLeave={() => setHandleHover(false)}
        onMouseDown={(e) => { e.preventDefault(); setResizing(true); }}
        title="Drag to resize"
        style={{
          position: 'absolute',
          top: 0, bottom: 0, left: 0,
          width: HANDLE_WIDTH,
          cursor: 'ew-resize',
          zIndex: 6,
          background: 'transparent',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0,
          width: 2,
          background: handleHover || resizing ? 'var(--accent-live)' : 'transparent',
          transition: 'background 200ms ease',
          pointerEvents: 'none',
          boxShadow: (handleHover || resizing)
            ? '0 0 12px color-mix(in oklch, var(--accent-live) 50%, transparent)'
            : 'none',
        }}/>
      </div>

      {/* ── Panel content ─────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `22px 18px 16px ${HANDLE_WIDTH + 14}px`,
          gap: 14,
          overflow: 'hidden',
          minWidth: 0,
        }}>
            <AlbumArt size={240} />

            {/* Track info */}
            <div style={{ width: '100%', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {isPlaying && <SoundWaveIcon size={13} />}
                <p style={{
                  fontFamily: 'var(--sans)', fontSize: 16, fontWeight: 700,
                  color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260,
                }}>
                  {currentTrack ? cleanTrackTitle(currentTrack.title) : 'Nothing playing'}
                </p>
              </div>
              <p style={{
                fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-secondary)',
                marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {currentTrack?.artist ?? '—'}
              </p>
            </div>

            {/* Inline mini-lyrics — sits at the TOP of the panel (right
                after track info, before the controls) so it's always
                visible without scrolling. Click anywhere to expand to
                fullscreen. Hidden when there's no synced lyrics. */}
            {currentTrack && <MiniLyrics />}

            {/* Like + Lyrics + playback controls
                (seek + volume live in the PlayerBar — no duplicates here) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                onClick={handleLike}
                disabled={!currentTrack}
                title={currentTrack?.liked ? 'Unlike' : 'Like'}
                style={{
                  background: 'transparent', border: 'none',
                  cursor: currentTrack ? 'pointer' : 'default',
                  color: currentTrack?.liked ? 'var(--accent)' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', padding: 4,
                }}
              >
                <HeartStraight size={22} weight={currentTrack?.liked ? 'fill' : 'regular'} />
              </button>
              <button
                onClick={() => setLyricsFullscreen(true)}
                disabled={!currentTrack}
                title="Open fullscreen lyrics"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 999,
                  background: 'var(--bg-overlay)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                  cursor: currentTrack ? 'pointer' : 'default',
                  opacity: currentTrack ? 1 : 0.5,
                  fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600,
                }}
              >
                <MicrophoneStage size={13} weight="bold"/>
                Lyrics
              </button>
            </div>
            <PlaybackControls variant="full" />

            {/* Lyrics tab + content removed — fullscreen lyrics (mic button
                in PlayerBar) is the single way to view lyrics. Less clutter
                in the panel, more vertical space for recommendations. */}

            {/* Recommended row (Spotify-style) */}
            {currentTrack && recommendations.length > 0 && (
              <div style={{
                width: '100%', flexShrink: 0,
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 10, marginTop: 'auto',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  marginBottom: 8,
                }}>
                  <h3 style={{
                    fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
                  }}>
                    Recommended
                  </h3>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 10,
                    color: 'var(--text-muted)',
                  }}>
                    {recommendations.length}
                  </span>
                </div>
                <div style={{
                  display: 'flex', gap: 10, overflowX: 'auto', overflowY: 'hidden',
                  paddingBottom: 4, scrollbarWidth: 'thin',
                }}>
                  {recommendations.slice(0, 12).map((r) => (
                    <div
                      key={r.youtube_id}
                      onClick={() => playTrack({
                        video_id: r.youtube_id,
                        title: r.title,
                        artist: r.artist,
                        duration_seconds: r.duration_seconds,
                        thumbnail_url: r.thumbnail_url,
                      }).catch(console.error)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        addToQueue(r as any)
                          .then(() => toast.success('Added to queue', r.title))
                          .catch(() => toast.error('Could not add to queue'));
                      }}
                      title={`${r.title} — ${r.artist}\nClick to play · Right-click to queue`}
                      style={{
                        flexShrink: 0, width: 108, cursor: 'pointer',
                        transition: 'transform 150ms',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                    >
                      <div style={{
                        width: 108, height: 108, borderRadius: 7, marginBottom: 6,
                        background: r.thumbnail_url
                          ? `center/cover url(${r.thumbnail_url})`
                          : 'var(--bg-overlay)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      }}/>
                      <p style={{
                        fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600,
                        color: 'var(--text-primary)', margin: 0, lineHeight: 1.25,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{r.title}</p>
                      <p style={{
                        fontFamily: 'var(--sans)', fontSize: 11,
                        color: 'var(--text-muted)', margin: '2px 0 0',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{r.artist}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
      </div>
    </aside>
  );
}

