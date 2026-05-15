import { useState, useEffect } from 'react';
import { HeartStraight, MicrophoneStage, Queue as QueueIcon, Play, ArrowRight, ArrowSquareOut } from '@phosphor-icons/react';
import { getArtistInfo, type ArtistInfo } from '../../lib/artistInfo';
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
  const activePlaylistName = useUiStore((s) => s.activePlaylistName);
  const activeView = useUiStore((s) => s.activeView);
  const nextUp = queue[0] ?? null;

  const playingFromLabel = (() => {
    if (!currentTrack) return null;
    if (activeView === 'liked' || (activePlaylistName && activeView === 'playlist')) {
      return activeView === 'liked' ? 'Liked Songs' : activePlaylistName;
    }
    if (currentTrack.liked) return 'Liked Songs';
    return 'Now Playing';
  })();
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
            {currentTrack && (
              <div style={{
                width: '100%', textAlign: 'left',
                fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700,
                color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                paddingBottom: 2,
              }}>
                {playingFromLabel ?? 'Now Playing'}
              </div>
            )}

            <AlbumArt size={240} />

            {}
            <div style={{ width: '100%', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isPlaying && <SoundWaveIcon size={14} />}
                <p style={{
                  fontFamily: 'var(--sans)', fontSize: 19, fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.005em',
                  textTransform: 'uppercase',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1, minWidth: 0,
                  lineHeight: 1.15,
                }}>
                  {currentTrack ? cleanTrackTitle(currentTrack.title) : 'Nothing playing'}
                </p>
              </div>
              <p style={{
                fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-secondary)',
                marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
              <AboutArtistCard
                artist={currentTrack.artist}
                fallbackThumb={currentTrack.thumbnail_url}
              />
            )}

            {}
            {currentTrack && recommendations.length > 0 && (() => {
              const artistKey = currentTrack.artist.trim().toLowerCase();
              const fromArtist = recommendations.filter((r) => r.artist.trim().toLowerCase() === artistKey);
              const others = recommendations.filter((r) => r.artist.trim().toLowerCase() !== artistKey);
              const showFromArtist = fromArtist.length >= 2;
              const list = showFromArtist ? fromArtist : others;
              const heading = showFromArtist ? `More from ${currentTrack.artist}` : 'You might also like';
              return (
                <div style={{
                  width: '100%', flexShrink: 0,
                  borderTop: 'none',
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
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: '85%',
                    }}>
                      {heading}
                    </h3>
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 10,
                      color: 'var(--text-muted)',
                    }}>
                      {list.length}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', gap: 10, overflowX: 'auto', overflowY: 'hidden',
                    paddingBottom: 4, scrollbarWidth: 'thin',
                  }}>
                    {list.slice(0, 12).map((r) => (
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
              );
            })()}
      </div>
    </aside>
  );
}

function AboutArtistCard({ artist, fallbackThumb }: { artist: string; fallbackThumb: string | null }) {
  const [info, setInfo] = useState<ArtistInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    setExpanded(false);
    setLoading(true);
    getArtistInfo(artist)
      .then((r) => { if (!cancelled) setInfo(r); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [artist]);

  const photo = info?.thumbnail_url ?? fallbackThumb;
  const extract = info?.extract ?? null;
  const wikiUrl = info?.wikipedia_url ?? null;

  let h = 0;
  for (let i = 0; i < artist.length; i++) h = (h * 31 + artist.charCodeAt(i)) % 360;

  const handleArtistClick = () => useUiStore.getState().setActiveArtist(artist);

  return (
    <div style={{ width: '100%', flexShrink: 0, marginTop: 4 }}>
      <h3 style={{
        fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 8,
      }}>
        About the artist
      </h3>
      <div style={{
        borderRadius: 12,
        background: 'color-mix(in oklch, var(--bg-overlay) 60%, transparent)',
        overflow: 'hidden',
      }}>
        {photo && (
          <div
            onClick={handleArtistClick}
            style={{
              width: '100%', height: 140,
              background: `center/cover url(${photo})`,
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.6) 100%)',
            }}/>
            <div style={{
              position: 'absolute', left: 14, bottom: 12,
              fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500,
              color: '#fff', letterSpacing: '-0.01em',
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
            }}>{artist}</div>
          </div>
        )}
        <div style={{ padding: '12px 14px' }}>
          {!photo && (
            <div
              onClick={handleArtistClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: `linear-gradient(135deg, oklch(0.45 0.12 ${h}), oklch(0.30 0.10 ${(h + 40) % 360}))`,
                display: 'grid', placeItems: 'center',
                fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 700, color: '#fff',
              }}>{(artist[0] ?? '?').toUpperCase()}</div>
              <div style={{
                fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--text-primary)',
                fontWeight: 500, letterSpacing: '-0.01em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{artist}</div>
            </div>
          )}

          {loading && (
            <div style={{
              fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-muted)',
              padding: '4px 0',
            }}>Loading bio…</div>
          )}

          {!loading && extract && (
            <p
              onClick={() => setExpanded((v) => !v)}
              style={{
                fontFamily: 'var(--sans)', fontSize: 12.5, lineHeight: 1.55,
                color: 'var(--text-secondary)',
                margin: 0, padding: 0,
                cursor: 'pointer',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: expanded ? 'unset' : 4,
                overflow: 'hidden',
              }}
            >
              {extract}
            </p>
          )}

          {!loading && !extract && (
            <p style={{
              fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-muted)',
              margin: 0, lineHeight: 1.5,
            }}>
              No bio found. Click the artist name to see their tracks in your library.
            </p>
          )}

          <div style={{
            display: 'flex', gap: 10, alignItems: 'center', marginTop: 12,
            paddingTop: 10,
          }}>
            <button
              onClick={handleArtistClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 999,
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 140ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-overlay)')}
            >
              View on Interwave <ArrowRight size={11} weight="bold" />
            </button>
            {wikiUrl && (
              <a
                href={wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)',
                  textDecoration: 'none',
                }}
              >
                Wikipedia <ArrowSquareOut size={10} weight="bold" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
