
use std::collections::VecDeque;
use std::io::{self, Read, Seek, SeekFrom};

const PRE_BUFFER_BYTES: usize = 128 * 1024;

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) \
                  AppleWebKit/537.36 (KHTML, like Gecko) \
                  Chrome/120.0.0.0 Safari/537.36";

pub struct HttpRangeReader {
    client: reqwest::blocking::Client,
    url: String,
    pos: u64,
    content_length: Option<u64>,
    pre_buffer: VecDeque<u8>,
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

        if !self.pre_buffer.is_empty() {
            let n = self.pre_buffer.len().min(buf.len());
            for (dst, src) in buf[..n].iter_mut().zip(self.pre_buffer.drain(..n)) {
                *dst = src;
            }
            self.pos += n as u64;
            return Ok(n);
        }

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
                if self.content_length.is_none() {
                    self.start_response(0)?;
                }
                let total = self.content_length.unwrap_or(0);

                if n >= 0 {
                    log::debug!("HttpRangeReader: SeekFrom::End({n}) → reporting EOF at {total} (no new request)");
                    self.pos = total;
                    return Ok(total);
                }

                (total as i64 + n).max(0) as u64
            }
        };

        if new_pos == self.pos && (self.response.is_some() || !self.pre_buffer.is_empty()) {
            return Ok(self.pos);
        }

        let buf_start = self.pos;
        let buf_end = buf_start + self.pre_buffer.len() as u64;
        if new_pos >= buf_start && new_pos < buf_end {
            let skip = (new_pos - buf_start) as usize;
            self.pre_buffer.drain(..skip);
            self.pos = new_pos;
            return Ok(self.pos);
        }

        self.response = None;
        self.pre_buffer.clear();
        self.start_response(new_pos)?;
        Ok(self.pos)
    }
}

unsafe impl Send for HttpRangeReader {}
