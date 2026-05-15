import { useState, useEffect } from 'react';
import { HeartStraight, MicrophoneStage, Queue as QueueIcon, Play, ArrowRight } from '@phosphor-icons/react';
import { usePlayerStore } from '../../stores/playerStore';
import { useUiStore } from '../../stores/uiStore';
import { likeTrack, unlikeTrack, playTrack, addToQueue } from '../../lib/tauri';
import { toast } from '../../stores/toastStore';
import { cleanTrackTitle } from '../../lib/cleanTitle';
import AlbumArt from '../player/AlbumArt';
import SoundWaveIcon from '../player/SoundWaveIcon';
import PlaybackControls from '../player/PlaybackControls';
import MiniLyrics from '../player/MiniLyrics';

const HANDLE_WIDTH = 6;

export default function NowPlayingPanel() {
  const { currentTrack, playbackState, setCurrentTrack, recommendations, queue } = usePlayerStore();
  const { rightPanelWidth, setRightPanelWidth, bumpLibraryVersion, setLyricsFullscreen, setActiveView } = useUiStore();
  const nextUp = queue[0] ?? null;
  const isPlaying = playbackState === 'playing';
  const [handleHover, setHandleHover] = useState(false);
  const [resizing, setResizing] = useState(false);

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
          linear-gradient(180deg,
            color-mix(in oklch, var(--accent-live) 14%, var(--bg-surface)) 0%,
            color-mix(in oklch, var(--accent-live) 6%, var(--bg-surface)) 35%,
            var(--bg-base) 100%
          )
        `,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
        transition: resizing ? 'none' : 'background 600ms ease',
      }}
    >
      {}
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

      {}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `22px 18px 16px ${HANDLE_WIDTH + 14}px`,
          gap: 14,
          overflowY: 'auto',
          overflowX: 'hidden',
          minWidth: 0,
        }}>
            <AlbumArt size={240} />

            {}
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

            {}
            {currentTrack && <MiniLyrics />}

            {}
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

            {}
            {currentTrack && (
              <div style={{ width: '100%', flexShrink: 0, marginTop: 6 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 8,
                }}>
                  <h3 style={{
                    fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
                  }}>
                    Next in queue
                  </h3>
                  <button
                    onClick={() => setActiveView('queue')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'none', border: 'none',
                      color: 'var(--text-muted)', cursor: 'pointer',
                      fontFamily: 'var(--mono)', fontSize: 10,
                      letterSpacing: '0.05em',
                      padding: '2px 4px', borderRadius: 4,
                      transition: 'color 120ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <QueueIcon size={11} weight="bold" /> Open Queue
                  </button>
                </div>
                {nextUp ? (
                  <div
                    onClick={() => playTrack({
                      video_id: nextUp.youtube_id,
                      title: nextUp.title,
                      artist: nextUp.artist,
                      duration_seconds: nextUp.duration_seconds,
                      thumbnail_url: nextUp.thumbnail_url,
                    }).catch(console.error)}
                    title="Click to play next now"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 8,
                      background: 'color-mix(in oklch, var(--bg-overlay) 70%, transparent)',
                      cursor: 'pointer',
                      transition: 'background 140ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-overlay)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'color-mix(in oklch, var(--bg-overlay) 70%, transparent)')}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 5, flexShrink: 0,
                      background: nextUp.thumbnail_url
                        ? `center/cover url(${nextUp.thumbnail_url})`
                        : 'var(--bg-elevated)',
                    }}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600,
                        color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{cleanTrackTitle(nextUp.title)}</div>
                      <div style={{
                        fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)',
                        marginTop: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{nextUp.artist}</div>
                    </div>
                    <Play size={14} weight="fill" color="var(--text-muted)" />
                    {queue.length > 1 && (
                      <span style={{
                        fontFamily: 'var(--mono)', fontSize: 9.5,
                        color: 'var(--text-muted)', marginLeft: 4,
                      }}>+{queue.length - 1}</span>
                    )}
                  </div>
                ) : (
                  <div style={{
                    padding: '10px 12px',
                    fontFamily: 'var(--sans)', fontSize: 11.5,
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    background: 'color-mix(in oklch, var(--bg-overlay) 50%, transparent)',
                    borderRadius: 8,
                  }}>
                    Nothing queued. Plays will autopick.
                  </div>
                )}
              </div>
            )}

            {}
            {currentTrack && (
              <div style={{ width: '100%', flexShrink: 0, marginTop: 4 }}>
                <h3 style={{
                  fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: 8,
                }}>
                  About the artist
                </h3>
                <div
                  onClick={() => useUiStore.getState().setActiveArtist(currentTrack.artist)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px',
                    borderRadius: 10,
                    background: 'color-mix(in oklch, var(--bg-overlay) 50%, transparent)',
                    cursor: 'pointer',
                    transition: 'background 140ms',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-overlay)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'color-mix(in oklch, var(--bg-overlay) 50%, transparent)')}
                >
                  <ArtistAvatar name={currentTrack.artist} thumbnail={currentTrack.thumbnail_url} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
                      color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{currentTrack.artist}</div>
                    <div style={{
                      fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)',
                      marginTop: 1,
                    }}>View artist page</div>
                  </div>
                  <ArrowRight size={12} weight="bold" color="var(--text-muted)" />
                </div>
              </div>
            )}

            {}
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

function ArtistAvatar({ name, thumbnail }: { name: string; thumbnail: string | null }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
  if (thumbnail) {
    return (
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        background: `center/cover url(${thumbnail})`,
      }}/>
    );
  }
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, oklch(0.45 0.12 ${h}), oklch(0.30 0.10 ${(h + 40) % 360}))`,
      display: 'grid', placeItems: 'center',
      fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700, color: '#fff',
    }}>{initials}</div>
  );
}
