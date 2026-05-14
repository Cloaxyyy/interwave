//! Blocking, seekable HTTP range-request reader for audio streaming.
//!
//! Architecture
//! ============
//!
//! ```text
//!  audio std::thread  (NOT the CPAL callback)
//!    └─ Decoder::new(HttpRangeReader)
//!         └─ Symphonia probe: seeks around the file
//!              ├─ seek(Start(0))     → Range: bytes=0-       (finds ftyp)
//!              ├─ seek(Current(N))   → same response (skip mdat)
//!              └─ seek(Start(moov))  → Range: bytes=M-       (reads moov)
//!              └─ seek(Start(mdat))  → Range: bytes=0-       (audio data)
//!         └─ probe succeeds ~300 ms after URL
//!
//!  CPAL callback thread
//!    └─ SymphoniaDecoder::next()
//!         └─ format.next_packet()
//!              └─ HttpRangeReader::read()
//!                   └─ pre_buffer: instant (built during probe)
//!                   └─ self.response: streaming from CDN, ~56× faster than
//!                      128 kbps playback so reads never block in practice
//! ```
//!
//! Each call to `seek()` that changes the file position starts a new HTTP
//! `Range: bytes=N-` request. The first `PRE_BUFFER_BYTES` of each request
//! are read synchronously into `pre_buffer` so that the CPAL callback never
//! makes a network call — it always reads from in-memory data.

use std::collections::VecDeque;
use std::io::{self, Read, Seek, SeekFrom};

/// Bytes pre-loaded into memory after each seek.
/// 128 KB is a good balance:
///   - Unthrottled CDN (~5 MB/s): downloads in ~25 ms — near-zero probe overhead.
///   - Throttled InnerTube URLs (~50 KB/s): downloads in ~2.5 s per seek.
/// At 128 kbps audio = 16 KB/s, 128 KB gives 8 seconds of buffer ahead of the
/// CPAL callback — more than enough even on a congested network.
const PRE_BUFFER_BYTES: usize = 128 * 1024;

/// User-agent sent with every request (mimics Chrome on Windows).
const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) \
                  AppleWebKit/537.36 (KHTML, like Gecko) \
                  Chrome/120.0.0.0 Safari/537.36";

pub struct HttpRangeReader {
    client: reqwest::blocking::Client,
    url: String,
    /// Current file position (bytes returned to the caller so far).
    pos: u64,
    /// Total file length, extracted from Content-Range on first response.
    content_length: Option<u64>,
    /// Eagerly-pre-buffered bytes following the current `pos`.
    /// Filled by `start_response()`, consumed by `read()`.
    pre_buffer: VecDeque<u8>,
    /// Active HTTP streaming response.  `None` if we haven't opened one yet
    /// or just seeked past what the current response can serve.
    response: Option<reqwest::blocking::Response>,
}

impl HttpRangeReader {
    pub fn new(url: String) -> Self {
        let client = reqwest::blocking::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(10))
            .timeout(std::time::Duration::from_secs(300))
            .build()
            .unwrap_or_default();
        Self {
            client,
            url,
            pos: 0,
            content_length: None,
            pre_buffer: VecDeque::new(),
            response: None,
        }
    }

    /// Open a new HTTP range request starting at `file_pos` and pre-buffer
    /// the first `PRE_BUFFER_BYTES` bytes so the CPAL callback never stalls.
    fn start_response(&mut self, file_pos: u64) -> io::Result<()> {
        log::debug!("HttpRangeReader: new range request bytes={file_pos}-");

        let resp = self
            .client
            .get(&self.url)
            .header("User-Agent", UA)
            .header("Accept", "*/*")
            .header("Range", format!("bytes={file_pos}-"))
            .send()
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;

        let status = resp.status().as_u16();
        if status != 206 && status != 200 {
            return Err(io::Error::new(
                io::ErrorKind::Other,
                format!("CDN HTTP {status} for bytes={file_pos}-"),
            ));
        }

        // Cache the total file length from Content-Range: bytes A-B/TOTAL
        if self.content_length.is_none() {
            if let Some(cr) = resp.headers().get("content-range") {
                if let Ok(s) = cr.to_str() {
                    if let Some(total_str) = s.split('/').nth(1) {
                        self.content_length = total_str.trim().parse().ok();
                        log::debug!(
                            "HttpRangeReader: content-length = {:?}",
                            self.content_length
                        );
                    }
                }
            }
        }

        let mut resp = resp;

        // Pre-buffer eagerly so the CPAL callback reads from memory, not the wire.
        let mut chunk = vec![0u8; PRE_BUFFER_BYTES];
        let n = resp.read(&mut chunk).unwrap_or(0);
        self.pre_buffer.clear();
        if n > 0 {
            self.pre_buffer.extend(&chunk[..n]);
        }

        self.response = Some(resp);
        self.pos = file_pos;
        Ok(())
    }

    /// Ensure we have an active response at the current `pos`.
    fn ensure_open(&mut self) -> io::Result<()> {
        if self.response.is_none() && self.pre_buffer.is_empty() {
            self.start_response(self.pos)?;
        }
        Ok(())
    }
}

impl Read for HttpRangeReader {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        if buf.is_empty() {
            return Ok(0);
        }
        self.ensure_open()?;

        // 1. Drain pre_buffer first (always fast, in-memory).
        if !self.pre_buffer.is_empty() {
            let n = self.pre_buffer.len().min(buf.len());
            for (dst, src) in buf[..n].iter_mut().zip(self.pre_buffer.drain(..n)) {
                *dst = src;
            }
            self.pos += n as u64;
            return Ok(n);
        }

        // 2. Read from the streaming HTTP response.
        //    At 128 kbps audio vs ≥1 MB/s download the TCP receive buffer
        //    almost always has data; this call is effectively instant.
        let n = match self.response.as_mut() {
            Some(r) => r.read(buf)?,
            None => 0,
        };
        self.pos += n as u64;
        Ok(n)
    }
}

impl Seek for HttpRangeReader {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        let new_pos: u64 = match pos {
            SeekFrom::Start(n) => n,
            SeekFrom::Current(n) => (self.pos as i64 + n).max(0) as u64,
            SeekFrom::End(n) => {
                // Ensure we know the file length.
                if self.content_length.is_none() {
                    // Fire a request at byte 0 just to read the Content-Range header.
                    self.start_response(0)?;
                }
                let total = self.content_length.unwrap_or(0);

                if n >= 0 {
                    // Seeking to or past EOF.  We MUST NOT send Range: bytes=total-
                    // because servers return HTTP 416 for that (no bytes exist past EOF).
                    // Symphonia issues SeekFrom::End(0) to probe the file length; we
                    // satisfy that by reporting `total` and leaving the existing response
                    // open so the next read continues from wherever the stream is.
                    log::debug!("HttpRangeReader: SeekFrom::End({n}) → reporting EOF at {total} (no new request)");
                    self.pos = total;
                    return Ok(total);
                }

                // n < 0: seek backwards from end (e.g. SeekFrom::End(-4) reads last 4 bytes).
                (total as i64 + n).max(0) as u64
            }
        };

        if new_pos == self.pos && (self.response.is_some() || !self.pre_buffer.is_empty()) {
            return Ok(self.pos); // Already here — no-op
        }

        // Is the target inside the pre_buffer? (forward skip within buffer)
        let buf_start = self.pos;
        let buf_end = buf_start + self.pre_buffer.len() as u64;
        if new_pos >= buf_start && new_pos < buf_end {
            let skip = (new_pos - buf_start) as usize;
            self.pre_buffer.drain(..skip);
            self.pos = new_pos;
            return Ok(self.pos);
        }

        // Otherwise: drop the current response and open a new one.
        self.response = None;
        self.pre_buffer.clear();
        self.start_response(new_pos)?;
        Ok(self.pos)
    }
}

// SAFETY: HttpRangeReader is Send because all its fields are Send:
// - reqwest::blocking::Client: explicitly Send
// - String, u64, Option<u64>, VecDeque<u8>: Send
// - reqwest::blocking::Response: Send
unsafe impl Send for HttpRangeReader {}
