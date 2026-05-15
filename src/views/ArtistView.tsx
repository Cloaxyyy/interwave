import { useEffect, useState, useMemo } from 'react';
import { Play, Pause, Check, Share, DotsThree, ArrowSquareOut } from '@phosphor-icons/react';
import { useUiStore } from '../stores/uiStore';
import { usePlayerStore } from '../stores/playerStore';
import {
  getLibrary, searchYoutube, playTrack,
  type Track, type SearchResult,
} from '../lib/tauri';
import { playWithContext } from '../lib/playContext';
import TrackTable from '../components/library/TrackTable';
import { TrackListSkeleton } from '../components/common/Skeleton';
import { cleanTrackTitle } from '../lib/cleanTitle';
import { getArtistInfo, type ArtistInfo } from '../lib/artistInfo';

function renderNameAccent(name: string): React.ReactNode {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const idx = trimmed.lastIndexOf(' ');
  if (idx <= 0 || idx >= trimmed.length - 1) return <em>{trimmed}</em>;
  return (<>{trimmed.slice(0, idx)} <em>{trimmed.slice(idx + 1)}</em></>);
}

function formatNumber(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function ArtistView() {
  const artist = useUiStore((s) => s.activeArtist);
  const { currentTrack, playbackState } = usePlayerStore();
  const isPlaying = playbackState === 'playing';

  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [topResults, setTopResults] = useState<SearchResult[]>([]);
  const [info, setInfo] = useState<ArtistInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [topLoading, setTopLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (!artist) return;
    setLoading(true); setTopLoading(true); setInfo(null);
    getLibrary().then(setAllTracks).finally(() => setLoading(false));
    searchYoutube(`${artist} popular songs`)
      .then((r) => setTopResults(r.slice(0, 8)))
      .finally(() => setTopLoading(false));
    getArtistInfo(artist).then(setInfo).catch(() => {});
  }, [artist]);

  const myTracks = useMemo(() => {
    if (!artist) return [];
    const q = artist.toLowerCase();
    return allTracks.filter((t) => t.artist?.toLowerCase().includes(q));
  }, [allTracks, artist]);

  if (!artist) {
    return (
      <div style={{
        flex: 1, display: 'grid', placeItems: 'center',
        color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontSize: 14,
      }}>
        No artist selected.
      </div>
    );
  }

  const playFromTop = (r: SearchResult) => {
    playTrack({
      video_id: r.youtube_id,
      title: r.title,
      artist: r.artist,
      duration_seconds: r.duration_seconds,
      thumbnail_url: r.thumbnail_url,
    }).catch(console.error);
  };

  const playPopular = () => {
    const list = myTracks.length > 0 ? myTracks : null;
    if (list) {
      playWithContext(list[0], list).catch(console.error);
    } else if (topResults[0]) {
      playFromTop(topResults[0]);
    }
  };

  const photo = info?.thumbnail_url ?? topResults[0]?.thumbnail_url ?? null;
  const monthly = formatNumber(myTracks.reduce((s, t) => s + (t.play_count ?? 0), 0));

  return (
    <div className="iw-page-bg" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* HERO */}
        <div className="iw-artist-hero">
          <div className="iw-artist-photo">
            {photo
              ? <img src={photo} alt={artist} draggable={false}/>
              : <span style={{ fontFamily: 'var(--serif)', fontSize: 96, fontStyle: 'italic', color: 'rgba(255,255,255,0.6)' }}>
                  {artist[0]?.toUpperCase() ?? '♪'}
                </span>
            }
            <div className="iw-photo-tag">
              <span className="iw-verify"><Check size={9} weight="bold"/></span>
              <span>Artist</span>
            </div>
          </div>

          <div className="iw-artist-info">
            <div className="iw-artist-kicker">
              <span className="iw-pulse"></span>
              {monthly && <span>{monthly} plays in your library</span>}
              {monthly && <span style={{ color: 'var(--text-disabled)' }}>·</span>}
              <span>{myTracks.length} {myTracks.length === 1 ? 'track' : 'tracks'} owned</span>
            </div>
            <h1 className="iw-artist-name">{renderNameAccent(artist)}</h1>

            <div className="iw-artist-actions">
              <button className="iw-btn-pill iw-btn-primary" onClick={playPopular}
                disabled={myTracks.length === 0 && topResults.length === 0}>
                {isPlaying && currentTrack && currentTrack.artist.toLowerCase() === artist.toLowerCase()
                  ? <><Pause size={14} weight="fill"/> Pause</>
                  : <><Play  size={14} weight="fill"/> Play</>}
              </button>
              <button
                className="iw-btn-pill iw-btn-ghost-pill"
                onClick={() => setFollowing(!following)}
                style={following ? {
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                } : undefined}
              >
                {following && <Check size={14} weight="bold"/>}
                <span>{following ? 'Following' : 'Follow'}</span>
              </button>
              <button className="iw-icon-btn" title="Share"><Share size={16} weight="bold"/></button>
              <button className="iw-icon-btn" title="More options"><DotsThree size={20} weight="bold"/></button>
            </div>
          </div>
        </div>

        {/* TWO-COLUMN BODY */}
        <div className="iw-artist-body">
          {/* LEFT — Popular tracks */}
          <div>
            <div className="iw-section-h">
              <h2>Popular</h2>
              {topResults.length > 0 && (
                <button className="iw-link" onClick={() => {/* future: open full discography */}}>
                  See discography →
                </button>
              )}
            </div>

            {loading ? (
              <TrackListSkeleton count={4}/>
            ) : myTracks.length > 0 ? (
              <TrackTable
                tracks={myTracks.slice(0, 8)}
                onPlay={(t) => playWithContext(t, myTracks).catch(console.error)}
                onLikeToggle={() => {}}
                onAddToPlaylist={() => {}}
                currentTrackId={currentTrack?.id}
                playbackState={playbackState}
                showAlbum={false}
                showDateAdded={false}
              />
            ) : topLoading ? (
              <TrackListSkeleton count={4}/>
            ) : topResults.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--sans)' }}>
                Nothing surfaced for this artist yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {topResults.slice(0, 8).map((r, i) => (
                  <div
                    key={r.youtube_id}
                    onClick={() => playFromTop(r)}
                    className="iw-track-row"
                    style={{
                      gridTemplateColumns: '40px 1fr auto',
                    }}
                  >
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 13,
                      color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums',
                      textAlign: 'center',
                    }}>{i + 1}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 5, flexShrink: 0,
                        background: r.thumbnail_url ? `center/cover url(${r.thumbnail_url})` : 'var(--bg-overlay)',
                      }}/>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
                          color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{cleanTrackTitle(r.title)}</div>
                        <div style={{
                          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)',
                          marginTop: 2,
                        }}>{r.artist}</div>
                      </div>
                    </div>
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 12,
                      color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums',
                    }}>
                      {r.duration_seconds !== null
                        ? `${Math.floor(r.duration_seconds / 60)}:${String(Math.floor(r.duration_seconds % 60)).padStart(2, '0')}`
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — release / albums / about */}
          <div className="iw-right-col">
            {topResults[0] && (
              <div>
                <div className="iw-section-h"><h2>Top track</h2></div>
                <div className="iw-release-card" onClick={() => playFromTop(topResults[0])}>
                  <div className="iw-art">
                    {topResults[0].thumbnail_url
                      ? <img src={topResults[0].thumbnail_url} alt=""/>
                      : null}
                  </div>
                  <div className="iw-meta">
                    <div className="iw-t">{cleanTrackTitle(topResults[0].title)}</div>
                    <div className="iw-s">{topResults[0].artist}</div>
                    <div className="iw-ctrl">
                      <Play size={10} weight="fill"/><span>PLAY NOW</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {topResults.length > 1 && (
              <div>
                <div className="iw-section-h">
                  <h2>More on YouTube</h2>
                  <button className="iw-link">View all →</button>
                </div>
                <div className="iw-albums-grid">
                  {topResults.slice(1, 7).map((r) => (
                    <div className="iw-album-card" key={r.youtube_id} onClick={() => playFromTop(r)}>
                      <div className="iw-art" style={{
                        background: r.thumbnail_url
                          ? `center/cover url(${r.thumbnail_url})`
                          : 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
                      }}>
                        <button className="iw-play-fab" aria-label="Play" onClick={(e) => { e.stopPropagation(); playFromTop(r); }}>
                          <Play size={12} weight="fill"/>
                        </button>
                      </div>
                      <div className="iw-at">{cleanTrackTitle(r.title)}</div>
                      <div className="iw-ay">
                        {r.duration_seconds !== null
                          ? `${Math.floor(r.duration_seconds / 60)}:${String(Math.floor(r.duration_seconds % 60)).padStart(2, '0')}`
                          : '—'} · Track
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {info?.extract && (
              <div>
                <div className="iw-section-h"><h2>About</h2></div>
                <div className="iw-about-card">
                  <div className="iw-label-row">Bio · Wikipedia</div>
                  <p>{info.extract}</p>
                  {info.wikipedia_url && (
                    <a
                      href={info.wikipedia_url}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        marginTop: 12,
                        color: 'var(--accent)',
                        fontFamily: 'var(--mono)', fontSize: 11,
                        textDecoration: 'none', letterSpacing: '0.06em',
                      }}
                    >
                      Read on Wikipedia <ArrowSquareOut size={11} weight="bold"/>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
