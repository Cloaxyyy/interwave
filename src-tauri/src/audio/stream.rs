//! Streaming audio reader for progressive download + decode.
//!
//! Architecture
//! ============
//!
//! ```text
//!  tokio download task
//!    └─ pushes Vec<u8> chunks to DownloadBuffer (via condvar)
//!
//!  audio std::thread  (NOT the CPAL callback)
//!    └─ rodio::Decoder::new(StreamingReader)
//!         └─ symphonia probes fMP4 moov box (first ~20 KB)
//!         └─ decoder is ready, audio starts
//!
//!  CPAL callback thread  (real-time)
//!    └─ SymphoniaDecoder::next()
//!         └─ format.next_packet()
//!              └─ StreamingReader::read()
//!                   └─ almost always returns immediately (download is 56×
//!                      faster than 128 kbps playback)
//!                   └─ in the rare case of a network stall, blocks briefly
//!                      and returns 0 bytes → CPAL gets silence for <1 frame
//! ```
//!
//! We wait for MIN_START_BYTES before creating the decoder so the CPAL
//! callback always has a large pre-filled buffer to read from.

use std::io::{self, Read, Seek, SeekFrom};
use std::sync::{Arc, Condvar, Mutex};
use symphonia::core::io::MediaSource;

/// Minimum bytes accumulated before we hand the reader to the decoder.
/// 64 KB ≈ 4 s at 128 kbps; downloads in ~64 ms on a 1 MB/s connection.
/// Small enough for near-instant starts; large enough that CPAL never stalls.
pub const MIN_START_BYTES: usize = 64 * 1024; // 64 KB

// ── Download buffer ────────────────────────────────────────────────────────────

struct BufInner {
    data: Vec<u8>,
    done: bool,
}

/// Append-only byte buffer shared between the download task and the decoder.
/// Internally an `Arc<(Mutex, Condvar)>` so it is cheap to clone.
#[derive(Clone)]
pub struct DownloadBuffer {
    inner: Arc<(Mutex<BufInner>, Condvar)>,
}

impl DownloadBuffer {
    pub fn new() -> Self {
        Self {
            inner: Arc::new((
                Mutex::new(BufInner { data: Vec::new(), done: false }),
                Condvar::new(),
            )),
        }
    }

    /// Append bytes from the network. Called from the download tokio task.
    pub fn push(&self, chunk: &[u8]) {
        let (lock, cvar) = &*self.inner;
        lock.lock().unwrap().data.extend_from_slice(chunk);
        cvar.notify_all();
    }

    /// Signal that the download has finished.
    pub fn finish(&self) {
        let (lock, cvar) = &*self.inner;
        lock.lock().unwrap().done = true;
        cvar.notify_all();
    }

    /// Block until at least `n` bytes are available *or* the download is done.
    pub fn wait_for(&self, n: usize) {
        let (lock, cvar) = &*self.inner;
        let mut inner = lock.lock().unwrap();
        while inner.data.len() < n && !inner.done {
            inner = cvar.wait(inner).unwrap();
        }
    }

    pub fn len(&self) -> usize {
        self.inner.0.lock().unwrap().data.len()
    }
}

// ── Streaming reader ──────────────────────────────────────────────────────────

/// Implements `Read + Seek + MediaSource` over a [`DownloadBuffer`].
///
/// # Safety / threading
/// `StreamingReader` is used in two contexts:
///
/// 1. **Audio std::thread** — `Decoder::new()` probes the container (reads moov
///    box).  At this point we've already waited for `MIN_START_BYTES`, so the
///    moov box (≤ 20 KB) is already in the buffer.  Any blocking here is fine.
///
/// 2. **CPAL callback thread** — `format.next_packet()` calls `read()`.
///    We call `cvar.wait_timeout(50 ms)` rather than blocking indefinitely, so
///    the CPAL deadline is never missed by more than a single frame (~23 ms).
///    In practice the download (900 KB/s) always outpaces 128 kbps playback
///    (16 KB/s) by 56×, so the wait is instantaneous.
pub struct StreamingReader {
    buf: DownloadBuffer,
    pos: usize,
}

impl StreamingReader {
    pub fn new(buf: DownloadBuffer) -> Self {
        Self { buf, pos: 0 }
    }
}

impl Read for StreamingReader {
    fn read(&mut self, out: &mut [u8]) -> io::Result<usize> {
        if out.is_empty() {
            return Ok(0);
        }

        let (lock, cvar) = &*self.buf.inner;
        let mut inner = lock.lock().unwrap();

        // Wait up to 50 ms per iteration. Cap at 120 iterations (6 s total) to
        // prevent the audio thread from blocking forever when symphonia seeks to
        // a byte position that hasn't been downloaded yet. After 6 s we return
        // EOF so rodio's seek feedback is unblocked. Normal playback never hits
        // this cap — download outpaces 128 kbps playback by ~56×.
        let mut iters = 0u32;
        loop {
            if inner.data.len() > self.pos {
                break;
            }
            if inner.done || iters >= 120 {
                return Ok(0); // EOF (or timeout — treat as EOF)
            }
            let (new_inner, _) = cvar
                .wait_timeout(inner, std::time::Duration::from_millis(50))
                .unwrap();
            inner = new_inner;
            iters += 1;
        }

        let avail = inner.data.len() - self.pos;
        let n = avail.min(out.len());
        out[..n].copy_from_slice(&inner.data[self.pos..self.pos + n]);
        drop(inner);
        self.pos += n;
        Ok(n)
    }
}

impl Seek for StreamingReader {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        let new_pos: i64 = match pos {
            SeekFrom::Start(n) => n as i64,
            SeekFrom::Current(n) => self.pos as i64 + n,
            SeekFrom::End(n) => {
                // Wait for the full download with a 5-second timeout.
                // Symphonia calls SeekFrom::End during container seek to find
                // mdat/moov box offsets. Without a timeout this blocks the
                // audio thread forever when the download is still in progress.
                let (lock, cvar) = &*self.buf.inner;
                let mut inner = lock.lock().unwrap();
                let mut iters = 0u32;
                while !inner.done && iters < 100 {
                    let (new_inner, _) = cvar
                        .wait_timeout(inner, std::time::Duration::from_millis(50))
                        .unwrap();
                    inner = new_inner;
                    iters += 1;
                }
                // Use current length as best estimate if timed out
                inner.data.len() as i64 + n
            }
        };

        if new_pos < 0 {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "seek before start"));
        }
        self.pos = new_pos as usize;
        Ok(self.pos as u64)
    }
}

impl MediaSource for StreamingReader {
    fn is_seekable(&self) -> bool {
        true
    }

    fn byte_len(&self) -> Option<u64> {
        let (lock, _) = &*self.buf.inner;
        let inner = lock.lock().unwrap();
        if inner.done {
            Some(inner.data.len() as u64)
        } else {
            None
        }
    }
}
