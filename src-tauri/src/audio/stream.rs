
use std::io::{self, Read, Seek, SeekFrom};
use std::sync::{Arc, Condvar, Mutex};
use symphonia::core::io::MediaSource;

pub const MIN_START_BYTES: usize = 64 * 1024;

struct BufInner {
    data: Vec<u8>,
    done: bool,
}

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

    pub fn push(&self, chunk: &[u8]) {
        let (lock, cvar) = &*self.inner;
        lock.lock().unwrap().data.extend_from_slice(chunk);
        cvar.notify_all();
    }

    pub fn finish(&self) {
        let (lock, cvar) = &*self.inner;
        lock.lock().unwrap().done = true;
        cvar.notify_all();
    }

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

        let mut iters = 0u32;
        loop {
            if inner.data.len() > self.pos {
                break;
            }
            if inner.done || iters >= 120 {
                return Ok(0);
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
