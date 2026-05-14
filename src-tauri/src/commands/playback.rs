use serde::Serialize;
use std::sync::{Arc, atomic::{AtomicU64, Ordering}};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

fn unix_now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

use crate::audio::thread::{AudioCommand, AudioHandle, PlaybackState};
use crate::db::tracks::Track;
use crate::discord::DiscordHandle;
use crate::error::WaveError;
use crate::state::{AppState, PrefetchCache, UrlCache, URL_CACHE_TTL_SECS};

const SKIP_PREV_THRESHOLD_SECS: f64 = 3.0;

// ── Event payloads ─────────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
struct StateEvent { state: String }

#[derive(Clone, Serialize)]
struct TrackEvent { track: Track }

#[derive(Clone, Serialize)]
struct PositionEvent { position: f64, duration: f64 }

#[derive(Clone, Serialize)]
struct QueueEvent { queue: Vec<Track> }

#[derive(Clone, Serialize)]
struct ErrorEvent { message: String }

#[derive(Clone, Serialize)]
struct WaveformEvent { bars: Vec<f32> }

fn emit_error(app: &AppHandle, msg: impl Into<String>) {
    let msg = msg.into();
    log::error!("Playback error: {msg}");
    app.emit("playback://error", ErrorEvent { message: msg }).ok();
}

// ── URL resolution ─────────────────────────────────────────────────────────────

fn get_cached_url(cache: &UrlCache, youtube_id: &str) -> Option<String> {
    let map = cache.lock().unwrap();
    if let Some((url, resolved_at)) = map.get(youtube_id) {
        if resolved_at.elapsed().as_secs() < URL_CACHE_TTL_SECS {
            return Some(url.clone());
        }
    }
    None
}

fn set_cached_url(cache: &UrlCache, youtube_id: &str, url: &str) {
    let mut map = cache.lock().unwrap();
    map.insert(youtube_id.to_string(), (url.to_string(), std::time::Instant::now()));
}

/// Persist a resolved URL to both the in-memory cache and SQLite.
fn persist_url(cache: &UrlCache, db: &crate::state::DbPool, youtube_id: &str, url: &str) {
    set_cached_url(cache, youtube_id, url);
    // Best-effort SQLite persist (non-blocking, errors are logged and ignored)
    if let Ok(conn) = db.get() {
        if let Err(e) = crate::db::url_cache::save_url(&conn, youtube_id, url) {
            log::warn!("Failed to persist URL to SQLite for {youtube_id}: {e}");
        }
    }
}

/// Download 32 KB from `url` and return true only if the transfer rate
/// exceeds 200 KB/s — indicating an **unthrottled** CDN URL.
///
/// YouTube throttles InnerTube URLs (n-param not decoded) to ~25 KB/s.
/// Piped and yt-dlp return unthrottled URLs at 5+ MB/s.  The speed gate
/// prevents a fast-resolving-but-throttled URL from winning the race and
/// causing the HttpRangeReader probe to stall for 30+ seconds.
async fn url_is_fast(url: &str) -> bool {
    let client = match reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(4))
        .timeout(std::time::Duration::from_secs(6))
        .build()
    {
        Ok(c) => c,
        Err(_) => return true, // assume fast on build failure
    };

    let start = std::time::Instant::now();
    let resp = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0")
        .header("Range", "bytes=0-32767") // 32 KB probe
        .send()
        .await;

    match resp {
        Ok(r) if r.status().as_u16() == 206 || r.status().as_u16() == 200 => {
            match r.bytes().await {
                Ok(b) if b.len() > 4096 => {
                    let elapsed = start.elapsed().as_secs_f64().max(0.001);
                    let speed_kbs = (b.len() as f64 / 1024.0) / elapsed;
                    let fast = speed_kbs > 200.0;
                    log::info!(
                        "URL speed: {:.0} KB/s → {}",
                        speed_kbs,
                        if fast { "✓ fast" } else { "✗ throttled" }
                    );
                    fast
                }
                _ => false,
            }
        }
        _ => false,
    }
}

/// Resolve a YouTube stream URL.
///
/// Fires **three resolvers simultaneously** and returns the first URL that
/// passes a 32 KB speed gate (> 200 KB/s):
///
/// 1. **InnerTube** (~300 ms) — fires 6 YouTube API clients concurrently.
///    Returns an unthrottled m4a URL when any client succeeds without cipher.
///    Protected by the speed gate — throttled URLs (~25 KB/s) are rejected.
/// 2. **Piped API** (0.5–2 s) — tries 3 public instances concurrently.
///    Piped decodes YouTube's `n` parameter → always unthrottled CDN speed.
/// 3. **yt-dlp** (5–10 s) — spawned immediately in a blocking thread.
///    Always returns an unthrottled URL; wins only when both above fail.
///
/// The speed gate downloads 32 KB and rejects URLs < 200 KB/s so throttled
/// InnerTube URLs can never win the race (they download at ~25 KB/s).
async fn resolve_url(youtube_id: &str) -> Result<String, WaveError> {
    use tokio::sync::mpsc;

    let (tx, mut rx) = mpsc::channel::<Result<String, WaveError>>(3);

    // ── 1. InnerTube — fastest path (~300 ms when a client returns plain URL) ──
    {
        let vid = youtube_id.to_string();
        let tx = tx.clone();
        tokio::spawn(async move {
            let result = crate::audio::ytdlp::resolve_stream_url_innertube(&vid).await;
            match result {
                Ok(ref u) => {
                    log::info!("InnerTube resolved URL for {vid}, checking speed…");
                    if url_is_fast(u).await {
                        let _ = tx.send(Ok(u.clone())).await;
                    } else {
                        log::warn!("InnerTube URL failed speed gate for {vid} (throttled)");
                        let _ = tx.send(Err(WaveError::YtDlp("InnerTube URL throttled".into()))).await;
                    }
                }
                Err(e) => { let _ = tx.send(Err(e)).await; }
            }
        });
    }

    // ── 2. Piped API — reliable fast path ─────────────────────────────────────
    {
        let vid = youtube_id.to_string();
        let tx = tx.clone();
        tokio::spawn(async move {
            let result = crate::audio::ytdlp::resolve_stream_url_piped(&vid).await;
            if let Ok(ref u) = result {
                log::info!("Piped resolved URL for {vid}, checking speed…");
                if !url_is_fast(u).await {
                    let _ = tx.send(Err(WaveError::YtDlp("Piped URL failed speed gate".into()))).await;
                    return;
                }
            }
            let _ = tx.send(result).await;
        });
    }

    // ── 3. yt-dlp — reliable last resort ──────────────────────────────────────
    {
        let vid = youtube_id.to_string();
        let tx = tx.clone();
        tokio::task::spawn_blocking(move || {
            let result = crate::audio::ytdlp::resolve_stream_url(&vid);
            let _ = tx.blocking_send(result);
        });
    }

    drop(tx);

    let mut errors: Vec<String> = Vec::new();
    while let Some(result) = rx.recv().await {
        match result {
            Ok(url) => {
                log::info!("URL resolved for {youtube_id}");
                return Ok(url);
            }
            Err(e) => {
                log::warn!("Resolver failed for {youtube_id}: {e}");
                errors.push(e.to_string());
            }
        }
    }

    Err(WaveError::YtDlp(format!(
        "All resolvers failed for {youtube_id}: {}",
        errors.join("; ")
    )))
}

/// Download one 1 MB Range slice with up to 3 retries.
async fn fetch_chunk(
    client: &reqwest::Client,
    url: &str,
    ua: &str,
    start: u64,
    end: u64,
) -> Result<Vec<u8>, WaveError> {
    let range_hdr = format!("bytes={start}-{end}");
    let mut last_err = String::new();

    for attempt in 1u8..=3 {
        match client
            .get(url)
            .header("User-Agent", ua)
            .header("Accept", "*/*")
            .header("Range", &range_hdr)
            .send()
            .await
        {
            Err(e) => {
                last_err = e.to_string();
                if attempt < 3 {
                    tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
                }
            }
            Ok(resp) => {
                let status = resp.status().as_u16();
                if status != 206 && status != 200 {
                    return Err(WaveError::Network(format!(
                        "CDN returned HTTP {status} on {range_hdr} — URL expired?"
                    )));
                }
                let bytes = resp.bytes().await
                    .map_err(|e| WaveError::Network(format!("Body read error: {e}")))?;
                return Ok(bytes.to_vec());
            }
        }
    }
    Err(WaveError::Network(format!("Range {range_hdr} failed after 3 retries: {last_err}")))
}

/// Result of a progressive audio download.
/// `first_chunk` is available immediately; `tail_handle` resolves to the rest.
struct ProgressiveAudio {
    /// First 1 MB of the audio file (contains the m4a moov atom + initial mdat).
    first_chunk: Vec<u8>,
    /// Total file size (if the CDN returned Content-Range).
    total_bytes: Option<u64>,
    /// Pending parallel downloads for bytes 1 MB..EOF.
    /// Collect these to get the complete file.
    tail_handles: Vec<tokio::task::JoinHandle<Result<Vec<u8>, WaveError>>>,
}

impl ProgressiveAudio {
    /// Returns the full file bytes (first_chunk + all tail chunks in order).
    async fn collect_all(self) -> Result<Vec<u8>, WaveError> {
        let cap = self.total_bytes.unwrap_or(self.first_chunk.len() as u64 * 8) as usize;
        let mut buf: Vec<u8> = Vec::with_capacity(cap);
        buf.extend_from_slice(&self.first_chunk);
        for handle in self.tail_handles {
            let chunk = handle.await.map_err(|e| WaveError::Network(e.to_string()))??;
            if chunk.is_empty() { break; }
            buf.extend_from_slice(&chunk);
        }
        Ok(buf)
    }

}

/// Start a progressive audio download.
///
/// Returns as soon as the first 1 MB chunk is available.  The remaining
/// chunks are downloading in the background (JoinHandles in `tail_handles`).
///
/// Timeline:
///   T=0       send Range: bytes=0-1048575 AND launch remaining parallel ranges
///   T≈200 ms  first 1 MB arrives  ← return here
///   T≈800 ms  remaining chunks arrive  ← caller awaits tail_handles
async fn start_progressive_download(url: &str) -> Result<ProgressiveAudio, WaveError> {
    // 1 MB first chunk — large enough to always contain the moov box for any
    // YouTube m4a track.  At 5 MB/s CDN this arrives in ~200 ms.
    // Remaining chunks are also 1 MB each, downloaded in parallel.
    const FIRST_CHUNK: u64 = 1024 * 1024;
    const CHUNK: u64 = 1024 * 1024;

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(60))
        .http1_only()
        .build()
        .map_err(|e| WaveError::Network(e.to_string()))?;

    let ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    // ── 1. Fire first chunk — no HEAD needed ─────────────────────────────────
    let first_resp = client
        .get(url)
        .header("User-Agent", ua)
        .header("Accept", "*/*")
        .header("Range", format!("bytes=0-{}", FIRST_CHUNK - 1))
        .send()
        .await
        .map_err(|e| WaveError::Network(format!("Initial request failed: {e}")))?;

    let status = first_resp.status().as_u16();

    // Server returned the whole file (no range support) — just collect it.
    if status == 200 {
        let bytes = first_resp.bytes().await
            .map_err(|e| WaveError::Network(format!("Body read error: {e}")))?;
        log::info!("Download complete (no-range): {} bytes", bytes.len());
        return Ok(ProgressiveAudio {
            first_chunk: bytes.to_vec(),
            total_bytes: None,
            tail_handles: vec![],
        });
    }

    if status != 206 {
        return Err(WaveError::Network(format!("CDN returned HTTP {status} — URL may have expired")));
    }

    // ── 2. Learn total size from Content-Range header ─────────────────────────
    let total_bytes: Option<u64> = first_resp
        .headers()
        .get("content-range")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split('/').nth(1))
        .and_then(|s| s.trim().parse().ok());

    // ── 3. Launch remaining parallel chunks immediately ───────────────────────
    let mut tail_handles: Vec<tokio::task::JoinHandle<Result<Vec<u8>, WaveError>>> = Vec::new();

    if let Some(total) = total_bytes {
        if total > FIRST_CHUNK {
            let mut pos = FIRST_CHUNK;
            while pos < total {
                let end = (pos + CHUNK - 1).min(total - 1);
                let c = client.clone();
                let u = url.to_string();
                let ua_s = ua.to_string();
                tail_handles.push(tokio::spawn(async move {
                    fetch_chunk(&c, &u, &ua_s, pos, end).await
                }));
                pos = end + 1;
            }
        }
    }

    // ── 4. Collect first chunk body, return immediately ───────────────────────
    let first_bytes = first_resp.bytes().await
        .map_err(|e| WaveError::Network(format!("First chunk read error: {e}")))?;

    if first_bytes.is_empty() {
        return Err(WaveError::Network("Empty audio response".into()));
    }

    log::info!("Progressive: first chunk ready ({} bytes), {} tail chunks pending",
        first_bytes.len(), tail_handles.len());

    Ok(ProgressiveAudio {
        first_chunk: first_bytes.to_vec(),
        total_bytes,
        tail_handles,
    })
}

/// Download the complete audio in one shot (used by prefetch which doesn't benefit
/// from progressive decode, and as a fallback).
async fn download_audio(url: &str) -> Result<Vec<u8>, WaveError> {
    start_progressive_download(url).await?.collect_all().await
}

// ── Prefetch helpers ───────────────────────────────────────────────────────────

fn take_prefetched(cache: &PrefetchCache, youtube_id: &str) -> Option<Vec<u8>> {
    cache.lock().ok()?.remove(youtube_id)
}

fn store_prefetched(cache: &PrefetchCache, youtube_id: &str, bytes: Vec<u8>) {
    if let Ok(mut c) = cache.lock() {
        // Keep only the most recent prefetch to avoid unbounded memory use
        c.clear();
        c.insert(youtube_id.to_string(), bytes);
    }
}

/// Background prefetch: resolve URL + download audio for the next queued track.
/// Runs silently; errors are logged and ignored.
fn start_prefetch(
    track: Track,
    url_cache: UrlCache,
    prefetch_cache: PrefetchCache,
    db: crate::state::DbPool,
) {
    tokio::spawn(async move {
        // Skip if already cached
        if prefetch_cache.lock().map(|c| c.contains_key(&track.youtube_id)).unwrap_or(false) {
            return;
        }
        let url = if let Some(cached) = get_cached_url(&url_cache, &track.youtube_id) {
            cached
        } else {
            match resolve_url(&track.youtube_id).await {
                Ok(u) => {
                    persist_url(&url_cache, &db, &track.youtube_id, &u);
                    u
                }
                Err(e) => { log::warn!("Prefetch URL resolve failed for {}: {e}", track.youtube_id); return; }
            }
        };
        match download_audio(&url).await {
            Ok(bytes) => {
                log::info!("Prefetched {} ({} bytes)", track.youtube_id, bytes.len());
                store_prefetched(&prefetch_cache, &track.youtube_id, bytes);
            }
            Err(e) => log::warn!("Prefetch download failed for {}: {e}", track.youtube_id),
        }
    });
}

// ── Core playback pipeline ──────────────────────────────────────────────────────
//
// All audio is fully downloaded before being passed to rodio's Sink.
// This guarantees the CPAL real-time callback thread NEVER blocks on network I/O,
// which prevents the WASAPI deadlock that caused crashes on seek/stop/skip.
//
// Timeline (typical fast connection, InnerTube wins):
//   T=0        play_track called; InnerTube (7 clients) + yt-dlp race starts
//   T≈1-2 s    URL resolved by InnerTube
//   T≈2-3 s    Full audio downloaded via parallel Range requests
//   T≈2-3 s    PlayBuffered sent → audio starts 🔊 (in-memory decode only)
//
// Worst case (only yt-dlp succeeds):
//   T≈5-15 s   URL resolved → same fast download path above

fn start_playback(
    track: Track,
    app: AppHandle,
    audio: AudioHandle,
    poll_generation: Arc<AtomicU64>,
    url_cache: UrlCache,
    prefetch_cache: PrefetchCache,
    db: crate::state::DbPool,
    discord: DiscordHandle,
) {
    tokio::spawn(async move {
        if !audio.is_alive() {
            app.emit("playback://state", StateEvent { state: "stopped".into() }).ok();
            emit_error(&app, "Audio device failed to initialize — restart the app.");
            return;
        }

        // ── 1. Prefetch cache hit → decode to PCM, then play immediately ──────
        if let Some(bytes) = take_prefetched(&prefetch_cache, &track.youtube_id) {
            log::info!("Prefetch cache hit for {} ({} bytes)", track.youtube_id, bytes.len());
            let dur = track.duration_seconds.unwrap_or(0) as f64;

            // Decode to raw PCM — makes CPAL reads panic-free (SamplesBuffer is
            // just array indexing; Decoder::next() inside CPAL can panic on mid-file seeks).
            let decoded = tokio::task::spawn_blocking(move || {
                crate::audio::thread::decode_raw(bytes)
            }).await;

            let (samples, sample_rate, channels) = match decoded {
                Ok(Ok(r)) => r,
                Ok(Err(e)) => {
                    app.emit("playback://state", StateEvent { state: "stopped".into() }).ok();
                    emit_error(&app, format!("Audio decode failed: {e}"));
                    return;
                }
                Err(e) => {
                    app.emit("playback://state", StateEvent { state: "stopped".into() }).ok();
                    emit_error(&app, format!("Decode task failed: {e}"));
                    return;
                }
            };

            // Emit waveform before playback starts
            let waveform_bars = crate::audio::thread::compute_waveform(&samples, 200);
            app.emit("playback://waveform", WaveformEvent { bars: waveform_bars }).ok();

            let (result_tx, result_rx) = std::sync::mpsc::sync_channel::<Result<(), WaveError>>(1);
            if !audio.send(AudioCommand::PlayDecoded {
                samples,
                sample_rate,
                channels: channels as u16,
                track: track.clone(),
                result_tx,
            }) {
                app.emit("playback://state", StateEvent { state: "stopped".into() }).ok();
                emit_error(&app, "Audio device unavailable — restart the app.");
                return;
            }

            let started = tokio::task::spawn_blocking(move || result_rx.recv())
                .await.ok().and_then(|r| r.ok());

            match started {
                Some(Ok(())) => {
                    emit_playback_started(app, audio, track, dur, poll_generation, url_cache, prefetch_cache, discord, db);
                }
                Some(Err(e)) => {
                    app.emit("playback://state", StateEvent { state: "stopped".into() }).ok();
                    emit_error(&app, format!("Playback failed: {e}"));
                }
                None => {
                    app.emit("playback://state", StateEvent { state: "stopped".into() }).ok();
                    emit_error(&app, "Audio thread disconnected — restart the app.");
                }
            }
            return;
        }

        // ── 2. Resolve stream URL ──────────────────────────────────────────────
        let url = if let Some(cached) = get_cached_url(&url_cache, &track.youtube_id) {
            log::info!("URL cache hit for {}", track.youtube_id);
            cached
        } else {
            match resolve_url(&track.youtube_id).await {
                Ok(url) => {
                    // Persist to in-memory cache + SQLite so repeat plays are instant
                    persist_url(&url_cache, &db, &track.youtube_id, &url);
                    if let Ok(conn) = db.get() {
                        crate::db::tracks::upsert_track(&conn, &track).ok();
                        crate::db::tracks::increment_play_count(&conn, &track.id).ok();
                        crate::db::stats::record_session(
                            &conn, &track.id, &track.youtube_id,
                            &track.title, &track.artist,
                            track.thumbnail_url.as_deref(), track.duration_seconds,
                        ).ok();
                    }
                    url
                }
                Err(e) => {
                    app.emit("playback://state", StateEvent { state: "stopped".into() }).ok();
                    emit_error(&app, format!("Could not resolve audio stream: {e}"));
                    return;
                }
            }
        };

        let dur = track.duration_seconds.unwrap_or(0) as f64;

        // ── 3. Download ALL audio bytes, then PlayBuffered ─────────────────────
        //
        // Never stream directly into a rodio Sink — the CPAL callback would make
        // blocking HTTP reads, which deadlocks on WASAPI when sink.stop() is
        // called concurrently (e.g. seek, skip, or user clicking a new track).
        //
        // download_audio() uses parallel Range requests and typically completes
        // within 1-2 s on a fast connection for a 3-4 MB m4a file.

        let bytes = match download_audio(&url).await {
            Ok(b) => b,
            Err(e) => {
                app.emit("playback://state", StateEvent { state: "stopped".into() }).ok();
                emit_error(&app, format!("Download failed: {e}"));
                return;
            }
        };

        log::info!("Downloaded {} bytes for {}", bytes.len(), track.youtube_id);

        // Decode to raw PCM — this makes CPAL reads panic-free (SamplesBuffer is
        // just array indexing; Decoder::next() inside CPAL can panic on mid-file seeks).
        let bytes_for_decode = bytes;
        let decoded = tokio::task::spawn_blocking(move || {
            crate::audio::thread::decode_raw(bytes_for_decode)
        }).await;

        let (samples, sample_rate, channels) = match decoded {
            Ok(Ok(r)) => r,
            Ok(Err(e)) => {
                app.emit("playback://state", StateEvent { state: "stopped".into() }).ok();
                emit_error(&app, format!("Audio decode failed: {e}"));
                return;
            }
            Err(e) => {
                app.emit("playback://state", StateEvent { state: "stopped".into() }).ok();
                emit_error(&app, format!("Decode task failed: {e}"));
                return;
            }
        };

        // Emit waveform before playback starts
        let waveform_bars = crate::audio::thread::compute_waveform(&samples, 200);
        app.emit("playback://waveform", WaveformEvent { bars: waveform_bars }).ok();

        let (result_tx, result_rx) = std::sync::mpsc::sync_channel::<Result<(), WaveError>>(1);
        if !audio.send(AudioCommand::PlayDecoded {
            samples,
            sample_rate,
            channels: channels as u16,
            track: track.clone(),
            result_tx,
        }) {
            app.emit("playback://state", StateEvent { state: "stopped".into() }).ok();
            emit_error(&app, "Audio device unavailable — restart the app.");
            return;
        }

        let started = tokio::task::spawn_blocking(move || result_rx.recv())
            .await.ok().and_then(|r| r.ok());

        match started {
            Some(Ok(())) => {
                emit_playback_started(app, audio, track, dur, poll_generation, url_cache, prefetch_cache, discord, db);
            }
            Some(Err(e)) => {
                app.emit("playback://state", StateEvent { state: "stopped".into() }).ok();
                emit_error(&app, format!("Playback failed: {e}"));
            }
            None => {
                app.emit("playback://state", StateEvent { state: "stopped".into() }).ok();
                emit_error(&app, "Audio thread disconnected — restart the app.");
            }
        }
    });
}

/// Emit "playing" events and start the position-polling loop.
/// Called once PlayBuffered is confirmed started by the audio thread.
fn emit_playback_started(
    app: AppHandle,
    audio: AudioHandle,
    track: Track,
    dur: f64,
    poll_generation: Arc<AtomicU64>,
    url_cache: UrlCache,
    prefetch_cache: PrefetchCache,
    discord: DiscordHandle,
    db: crate::state::DbPool,
) {
    app.emit("playback://state", StateEvent { state: "playing".into() }).ok();
    app.emit("playback://track", TrackEvent { track: track.clone() }).ok();

    // Update Discord Rich Presence (with album art when available)
    discord.update(track.title.clone(), track.artist.clone(), track.thumbnail_url.clone());

    // Send a desktop notification for the new track
    {
        use tauri_plugin_notification::NotificationExt;
        let notif_title = track.title.clone();
        let notif_body = track.artist.clone();
        let _ = app.notification()
            .builder()
            .title(&notif_title)
            .body(&notif_body)
            .show();
    }

    let snap = audio.snapshot();
    app.emit("playback://queue", QueueEvent { queue: snap.queue.clone() }).ok();

    if let Some(next) = snap.queue.first().cloned() {
        start_prefetch(next, url_cache, prefetch_cache, db);
    }

    let gen = poll_generation.fetch_add(1, Ordering::SeqCst) + 1;
    let app_p = app.clone();
    let audio_p = audio.clone();
    let pg = poll_generation;

    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            if pg.load(Ordering::SeqCst) != gen { break; }
            let snap = audio_p.snapshot();
            match snap.state {
                PlaybackState::Stopped => {
                    app_p.emit("playback://state", StateEvent { state: "ended".into() }).ok();
                    break;
                }
                PlaybackState::Playing => {
                    // Compute live position from timestamp so the UI timer doesn't freeze
                    let live_pos = match snap.playing_since_unix_ms {
                        Some(started_ms) => {
                            let elapsed = (unix_now_ms().saturating_sub(started_ms)) as f64 / 1000.0;
                            snap.paused_at_secs + elapsed
                        }
                        None => snap.paused_at_secs,
                    };
                    app_p.emit("playback://position", PositionEvent {
                        position: live_pos,
                        duration: dur,
                    }).ok();
                }
                _ => {}
            }
        }
    });
}

// ── Tauri commands ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn play_track(
    video_id: String,
    title: String,
    artist: String,
    album: Option<String>,
    duration_seconds: Option<i64>,
    thumbnail_url: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), WaveError> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let track = state.db
        .get()
        .ok()
        .and_then(|conn| crate::db::tracks::get_track_by_youtube_id(&conn, &video_id).ok().flatten())
        .unwrap_or_else(|| Track {
            id: Uuid::new_v4().to_string(),
            youtube_id: video_id.clone(),
            title: title.clone(),
            artist: artist.clone(),
            album: album.clone(),
            duration_seconds,
            thumbnail_url: thumbnail_url.clone(),
            play_count: 0,
            last_played_at: None,
            liked: false,
            created_at: now,
            local_path: None,
        });

    app.emit("playback://state", StateEvent { state: "loading".into() }).ok();
    app.emit("playback://track", TrackEvent { track: track.clone() }).ok();

    start_playback(
        track, app,
        state.audio.clone(),
        state.poll_generation.clone(),
        state.url_cache.clone(),
        state.prefetch_cache.clone(),
        state.db.clone(),
        state.discord.clone(),
    );

    Ok(())
}

#[tauri::command]
pub async fn skip_next(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), WaveError> {
    match state.audio.pop_queue() {
        None => {
            state.audio.send(AudioCommand::Stop);
            app.emit("playback://state", StateEvent { state: "stopped".into() }).ok();
            app.emit("playback://queue", QueueEvent { queue: vec![] }).ok();
            state.discord.clear();
        }
        Some(track) => {
            app.emit("playback://state", StateEvent { state: "loading".into() }).ok();
            app.emit("playback://track", TrackEvent { track: track.clone() }).ok();
            start_playback(
                track, app, state.audio.clone(),
                state.poll_generation.clone(), state.url_cache.clone(),
                state.prefetch_cache.clone(), state.db.clone(),
                state.discord.clone(),
            );
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn skip_prev(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), WaveError> {
    let snap = state.audio.snapshot();
    if snap.position_secs > SKIP_PREV_THRESHOLD_SECS {
        state.audio.send(AudioCommand::Seek(0.0));
        return Ok(());
    }
    if let Some(prev) = state.audio.pop_history() {
        app.emit("playback://state", StateEvent { state: "loading".into() }).ok();
        app.emit("playback://track", TrackEvent { track: prev.clone() }).ok();
        start_playback(
            prev, app, state.audio.clone(),
            state.poll_generation.clone(), state.url_cache.clone(),
            state.prefetch_cache.clone(), state.db.clone(),
            state.discord.clone(),
        );
    }
    Ok(())
}

#[tauri::command]
pub fn pause(app: AppHandle, state: State<'_, AppState>) -> Result<(), WaveError> {
    state.audio.send(AudioCommand::Pause);
    app.emit("playback://state", StateEvent { state: "paused".into() }).ok();
    Ok(())
}

#[tauri::command]
pub fn resume(app: AppHandle, state: State<'_, AppState>) -> Result<(), WaveError> {
    state.audio.send(AudioCommand::Resume);
    app.emit("playback://state", StateEvent { state: "playing".into() }).ok();
    Ok(())
}

#[tauri::command]
pub fn set_volume(level: f32, state: State<'_, AppState>) -> Result<(), WaveError> {
    state.audio.send(AudioCommand::SetVolume(level));
    Ok(())
}

#[tauri::command]
pub fn get_queue(state: State<'_, AppState>) -> Result<Vec<Track>, WaveError> {
    Ok(state.audio.snapshot().queue)
}

#[tauri::command]
pub fn add_to_queue(track: Track, app: AppHandle, state: State<'_, AppState>) -> Result<(), WaveError> {
    state.audio.send(AudioCommand::AddToQueue(track));
    let q = state.audio.snapshot().queue;
    app.emit("playback://queue", QueueEvent { queue: q }).ok();
    Ok(())
}

#[tauri::command]
pub fn clear_queue(app: AppHandle, state: State<'_, AppState>) -> Result<(), WaveError> {
    state.audio.send(AudioCommand::ClearQueue);
    app.emit("playback://queue", QueueEvent { queue: vec![] }).ok();
    Ok(())
}

// async because start_prefetch internally calls tokio::spawn
#[tauri::command]
pub async fn set_queue(tracks: Vec<Track>, app: AppHandle, state: State<'_, AppState>) -> Result<(), WaveError> {
    state.audio.send(AudioCommand::SetQueue(tracks));
    let q = state.audio.snapshot().queue;
    app.emit("playback://queue", QueueEvent { queue: q.clone() }).ok();
    // Prefetch first item in the new queue
    if let Some(next) = q.into_iter().next() {
        start_prefetch(next, state.url_cache.clone(), state.prefetch_cache.clone(), state.db.clone());
    }
    Ok(())
}

// Must be async — calls tokio::spawn for the post-seek event emit.
#[tauri::command]
pub async fn seek(
    position_secs: f64,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), WaveError> {
    log::info!("[seek cmd] called with position_secs={position_secs}");
    if !position_secs.is_finite() || position_secs < 0.0 {
        log::warn!("[seek cmd] rejecting non-finite/negative position");
        return Err(WaveError::Internal(format!("Invalid seek position: {position_secs}")));
    }
    if !state.audio.is_alive() {
        log::error!("[seek cmd] audio thread is DEAD — refusing to seek");
        emit_error(&app, "Audio engine stopped — please restart Interwave.");
        return Err(WaveError::Audio("Audio thread dead".into()));
    }
    let sent = state.audio.send(AudioCommand::Seek(position_secs));
    log::info!("[seek cmd] AudioCommand::Seek sent (channel accepted: {sent})");

    // Give the audio thread ~60ms to apply the seek, then emit the new position
    let audio = state.audio.clone();
    let pos = position_secs;
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(60)).await;
        let snap = audio.snapshot();
        let dur = snap.current_track
            .as_ref()
            .and_then(|t| t.duration_seconds)
            .unwrap_or(0) as f64;
        let live_pos = match snap.playing_since_unix_ms {
            Some(started_ms) => {
                let elapsed = (unix_now_ms().saturating_sub(started_ms)) as f64 / 1000.0;
                (snap.paused_at_secs + elapsed).max(pos - 0.5) // use pos as floor so UI doesn't jump back
            }
            None => snap.paused_at_secs,
        };
        app.emit("playback://position", serde_json::json!({
            "position": live_pos,
            "duration": dur,
        })).ok();
        let state_str = match snap.state {
            crate::audio::thread::PlaybackState::Playing => "playing",
            crate::audio::thread::PlaybackState::Paused  => "paused",
            crate::audio::thread::PlaybackState::Loading => "loading",
            _ => "playing",
        };
        app.emit("playback://state", serde_json::json!({ "state": state_str })).ok();
        // Notify the frontend that a seek happened so it can cancel any pending
        // AutoMix gapless timer.  This prevents the timer from firing if the user
        // seeks backward after the about_to_end transition point.
        app.emit("playback://seeked", serde_json::json!({ "position": live_pos })).ok();
    });

    Ok(())
}

#[tauri::command]
pub fn set_shuffle(enabled: bool, state: State<'_, AppState>) -> Result<(), WaveError> {
    state.audio.send(AudioCommand::SetShuffle(enabled));
    Ok(())
}

#[tauri::command]
pub fn set_repeat(mode: String, state: State<'_, AppState>) -> Result<(), WaveError> {
    if !["off", "one", "all"].contains(&mode.as_str()) {
        return Err(WaveError::Internal(
            "invalid repeat mode: must be off, one, or all".into(),
        ));
    }
    state.audio.send(AudioCommand::SetRepeat(mode));
    Ok(())
}

#[tauri::command]
pub fn set_speed(speed: f32, state: State<'_, AppState>) -> Result<(), WaveError> {
    state.audio.send(AudioCommand::SetSpeed(speed));
    Ok(())
}

// Crossfade was removed in favor of simple gapless transitions. The commands
// remain as no-ops so old frontends/settings UI don't error out.
#[tauri::command]
pub fn set_crossfade(_secs: f32, _state: State<'_, AppState>) -> Result<(), WaveError> {
    Ok(())
}

#[tauri::command]
pub fn get_crossfade(_state: State<'_, AppState>) -> Result<f32, WaveError> {
    Ok(0.0)
}

#[tauri::command]
pub async fn download_track(
    track_id: String,
    youtube_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, WaveError> {
    use crate::audio::ytdlp;

    // Get or create the downloads directory
    let download_dir = app.path()
        .app_data_dir()
        .map_err(|e| WaveError::Internal(e.to_string()))?
        .join("downloads");
    std::fs::create_dir_all(&download_dir)
        .map_err(|e| WaveError::Internal(e.to_string()))?;

    let output_path = download_dir.join(format!("{}.m4a", youtube_id));

    // If already downloaded, return early
    if output_path.exists() {
        let path_str = output_path.to_string_lossy().to_string();
        // Update DB
        let conn = state.db.get().map_err(WaveError::from)?;
        conn.execute(
            "UPDATE tracks SET local_path = ?1 WHERE id = ?2",
            rusqlite::params![path_str, track_id],
        ).map_err(WaveError::from)?;
        return Ok(path_str);
    }

    // Run yt-dlp to download audio only
    let vid = youtube_id.clone();
    let out = output_path.clone();
    let result = tokio::task::spawn_blocking(move || {
        let binary = ytdlp::find_ytdlp_binary()?;
        let url = format!("https://www.youtube.com/watch?v={}", vid);
        let output = std::process::Command::new(&binary)
            .args([
                "--no-playlist",
                "-f", "bestaudio[ext=m4a]/bestaudio",
                "--extract-audio",
                "--audio-format", "m4a",
                "--audio-quality", "0",
                "-o", &out.to_string_lossy(),
                "--no-warnings",
                &url,
            ])
            .output()
            .map_err(|e| WaveError::YtDlp(format!("Failed to launch yt-dlp: {e}")))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(WaveError::YtDlp(format!("yt-dlp download failed: {stderr}")));
        }
        Ok(out.to_string_lossy().to_string())
    }).await.map_err(|e| WaveError::Internal(e.to_string()))??;

    // Update DB with local path
    let conn = state.db.get().map_err(WaveError::from)?;
    conn.execute(
        "UPDATE tracks SET local_path = ?1 WHERE id = ?2",
        rusqlite::params![result, track_id],
    ).map_err(WaveError::from)?;

    Ok(result)
}

#[tauri::command]
pub fn set_eq_band(band: usize, db: f32, state: State<'_, AppState>) -> Result<(), WaveError> {
    state.eq.set_band(band, db);
    Ok(())
}

#[tauri::command]
pub fn get_eq_bands(state: State<'_, AppState>) -> Result<Vec<f32>, WaveError> {
    Ok(state.eq.get().to_vec())
}
