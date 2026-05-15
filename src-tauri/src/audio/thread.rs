use rodio::{Decoder, OutputStream, Sink, Source};
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::panic::AssertUnwindSafe;
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use std::time::{Duration, Instant};
use crate::db::tracks::Track;
use crate::error::WaveError;

use std::sync::atomic::AtomicUsize;

pub struct AtomicSeekSource {
    data: Arc<Vec<i16>>,
    pos: Arc<AtomicUsize>,
    sample_rate: u32,
    channels: u16,
}

impl AtomicSeekSource {
    pub fn new(data: Arc<Vec<i16>>, pos: Arc<AtomicUsize>, sample_rate: u32, channels: u16) -> Self {
        Self {
            data,
            pos,
            sample_rate: sample_rate.max(1),
            channels: channels.max(1),
        }
    }
}

impl Iterator for AtomicSeekSource {
    type Item = i16;
    #[inline]
    fn next(&mut self) -> Option<i16> {
        let p = self.pos.fetch_add(1, Ordering::Relaxed);
        if p >= self.data.len() { return None; }
        Some(self.data[p])
    }
    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        (0, None)
    }
}

impl Source for AtomicSeekSource {
    #[inline] fn current_frame_len(&self) -> Option<usize> { None }
    #[inline] fn channels(&self) -> u16 { self.channels }
    #[inline] fn sample_rate(&self) -> u32 { self.sample_rate }
    #[inline]
    fn total_duration(&self) -> Option<Duration> {
        let total_frames = self.data.len() as f64 / self.channels as f64;
        Some(Duration::from_secs_f64(total_frames / self.sample_rate as f64))
    }
}

fn unix_now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn decode_raw(bytes: Vec<u8>) -> Result<(Vec<i16>, u32, u16), WaveError> {
    use symphonia::core::{
        audio::SampleBuffer,
        codecs::DecoderOptions,
        errors::Error as SE,
        formats::FormatOptions,
        io::MediaSourceStream,
        meta::MetadataOptions,
        probe::Hint,
    };

    let mss = MediaSourceStream::new(
        Box::new(Cursor::new(bytes)),
        Default::default(),
    );
    let fmt_opts = FormatOptions { enable_gapless: false, ..Default::default() };

    let mut probed = symphonia::default::get_probe()
        .format(&Hint::new(), mss, &fmt_opts, &MetadataOptions::default())
        .map_err(|e| WaveError::Audio(format!("symphonia probe: {e}")))?;

    let track = probed.format.default_track()
        .ok_or_else(|| WaveError::Audio("no audio track in file".into()))?;

    let track_id   = track.id;
    let codec_sr   = track.codec_params.sample_rate.unwrap_or(48000);
    let codec_ch   = track.codec_params.channels
        .map(|c| c.count() as u16)
        .unwrap_or(2);

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| WaveError::Audio(format!("symphonia codec: {e}")))?;

    let mut samples: Vec<i16> = Vec::new();
    let mut sr = codec_sr;
    let mut ch = codec_ch;

    loop {
        let packet = match probed.format.next_packet() {
            Ok(p) => p,
            Err(SE::IoError(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(e) => { log::warn!("packet read ended: {e}"); break; }
        };
        if packet.track_id() != track_id { continue; }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                let spec = decoded.spec();
                if spec.rate == 0 || spec.channels.count() == 0 {
                    log::warn!("Skipping frame with invalid spec: rate={} ch={}", spec.rate, spec.channels.count());
                    continue;
                }
                sr = spec.rate;
                ch = spec.channels.count() as u16;
                let mut buf = SampleBuffer::<i16>::new(decoded.capacity() as u64, *spec);
                buf.copy_interleaved_ref(decoded);
                samples.extend_from_slice(buf.samples());
            }
            Err(SE::DecodeError(_)) => continue,
            Err(e) => { log::warn!("decode frame error: {e}"); break; }
        }
    }

    if samples.is_empty() {
        return Err(WaveError::Audio("decoded 0 samples".into()));
    }
    let sr = sr.max(1);
    let ch = ch.max(1);
    log::info!("direct-symphonia decoded {} samples sr={sr} ch={ch}", samples.len());
    Ok((samples, sr, ch))
}

fn decode_with_symphonia(bytes: Vec<u8>) -> Result<rodio::buffer::SamplesBuffer<i16>, WaveError> {
    let (mut samples, sr, ch) = decode_raw(bytes)?;
    normalize_samples(&mut samples);
    Ok(rodio::buffer::SamplesBuffer::new(ch, sr, samples))
}

pub enum AudioCommand {
    PlayBuffered {
        audio_bytes: Vec<u8>,
        track: Track,
        result_tx: std::sync::mpsc::SyncSender<Result<(), WaveError>>,
    },
    PlayDecoded {
        samples: Vec<i16>,
        sample_rate: u32,
        channels: u16,
        track: Track,
        result_tx: std::sync::mpsc::SyncSender<Result<(), WaveError>>,
    },
    AppendChunk {
        samples: Vec<i16>,
        sample_rate: u32,
        channels: u16,
    },
    Pause,
    Resume,
    Stop,
    SetVolume(f32),
    Seek(f64),
    AddToQueue(Track),
    ClearQueue,
    GetState {
        result_tx: std::sync::mpsc::SyncSender<AudioStateSnapshot>,
    },
    PopQueue {
        result_tx: std::sync::mpsc::SyncSender<Option<crate::db::tracks::Track>>,
    },
    PopHistory {
        result_tx: std::sync::mpsc::SyncSender<Option<Track>>,
    },
    SetShuffle(bool),
    SetRepeat(String),
    SetQueue(Vec<Track>),
    SetSpeed(f32),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PlaybackState {
    Playing,
    Paused,
    Loading,
    Stopped,
}

pub fn compute_waveform(samples: &[i16], n_bars: usize) -> Vec<f32> {
    if samples.is_empty() || n_bars == 0 {
        return vec![0.0; n_bars];
    }
    let chunk_size = (samples.len() / n_bars).max(1);
    let mut bars = Vec::with_capacity(n_bars);
    let chunks: Vec<&[i16]> = samples.chunks(chunk_size).collect();
    let actual = chunks.len().min(n_bars);

    for chunk in &chunks[..actual] {
        let rms = (chunk.iter()
            .map(|&s| (s as f64 / 32768.0).powi(2))
            .sum::<f64>() / chunk.len() as f64)
            .sqrt() as f32;
        bars.push(rms);
    }
    while bars.len() < n_bars {
        bars.push(0.0);
    }

    let max = bars.iter().cloned().fold(0.0_f32, f32::max);
    if max > 0.001 {
        for b in &mut bars {
            *b /= max;
        }
    }
    bars
}

#[derive(Debug, Clone)]
pub struct AudioStateSnapshot {
    pub current_track: Option<Track>,
    pub state: PlaybackState,
    pub position_secs: f64,
    pub playing_since_unix_ms: Option<u64>,
    pub paused_at_secs: f64,
    pub queue: Vec<Track>,
    pub volume: f32,
    pub speed: f32,
    pub shuffle: bool,
    pub repeat: String,
}

#[derive(Clone)]
pub struct AudioHandle {
    cmd_tx: std::sync::mpsc::SyncSender<AudioCommand>,
    pub shared: Arc<Mutex<AudioStateSnapshot>>,
    alive: Arc<AtomicBool>,
}

impl AudioHandle {
    pub fn send(&self, cmd: AudioCommand) -> bool {
        match self.cmd_tx.try_send(cmd) {
            Ok(()) => true,
            Err(e) => {
                log::error!("AudioHandle::send failed: {e}");
                false
            }
        }
    }

    pub fn is_alive(&self) -> bool {
        self.alive.load(Ordering::SeqCst)
    }

    pub fn snapshot(&self) -> AudioStateSnapshot {
        match self.shared.lock() {
            Ok(guard) => guard.clone(),
            Err(poisoned) => {
                log::error!("Audio shared-state mutex was poisoned — recovering");
                poisoned.into_inner().clone()
            }
        }
    }

    pub fn pop_queue(&self) -> Option<crate::db::tracks::Track> {
        let (result_tx, result_rx) = std::sync::mpsc::sync_channel(1);
        self.send(AudioCommand::PopQueue { result_tx });
        result_rx.recv().ok().flatten()
    }

    pub fn pop_history(&self) -> Option<Track> {
        let (tx, rx) = std::sync::mpsc::sync_channel(1);
        self.send(AudioCommand::PopHistory { result_tx: tx });
        rx.recv().ok().flatten()
    }
}

pub fn spawn_audio_thread() -> AudioHandle {
    let (cmd_tx, cmd_rx) = std::sync::mpsc::sync_channel::<AudioCommand>(64);

    let shared = Arc::new(Mutex::new(AudioStateSnapshot {
        current_track: None,
        state: PlaybackState::Stopped,
        position_secs: 0.0,
        playing_since_unix_ms: None,
        paused_at_secs: 0.0,
        queue: Vec::new(),
        volume: 0.8,
        speed: 1.0,
        shuffle: false,
        repeat: "off".to_string(),
    }));

    let alive = Arc::new(AtomicBool::new(true));
    let shared_clone = shared.clone();
    let alive_clone = alive.clone();

    std::thread::spawn(move || {
        let (_stream, stream_handle) = match OutputStream::try_default() {
            Ok(pair) => pair,
            Err(e) => {
                log::error!("Failed to open audio output device: {e}");
                alive_clone.store(false, Ordering::SeqCst);
                return;
            }
        };
        log::info!("Audio output device opened successfully");

        let mut sink: Option<Sink> = None;
        let mut current_track: Option<Track> = None;
        let mut queue: Vec<Track> = Vec::new();
        let mut history: std::collections::VecDeque<Track> = std::collections::VecDeque::new();
        let mut volume: f32 = 0.8;
        let mut speed: f32 = 1.0;
        let mut shuffle: bool = false;
        let mut repeat_mode: String = "off".to_string();
        let mut playback_started_at: Option<Instant> = None;
        let mut paused_position: f64 = 0.0;
        let mut current_pcm: Option<Arc<Vec<i16>>> = None;
        let mut current_pos: Option<Arc<AtomicUsize>> = None;
        let mut current_sr: u32 = 48000;
        let mut current_ch: u16 = 2;

        loop {
            match cmd_rx.recv_timeout(std::time::Duration::from_millis(50)) {
                Ok(cmd) => {
                    let result = std::panic::catch_unwind(AssertUnwindSafe(|| {
                match cmd {
                    AudioCommand::PlayBuffered { audio_bytes, track, result_tx } => {
                        if let Some(t) = current_track.take() {
                            history.push_back(t);
                            if history.len() > 50 { history.pop_front(); }
                        }
                        prepare_playback(&mut current_track, &mut sink, &mut playback_started_at, &mut paused_position, &shared_clone, &track, &queue, volume);

                        enum PlaySource {
                            Rodio(Decoder<Cursor<Vec<u8>>>),
                            Pcm(rodio::buffer::SamplesBuffer<i16>),
                        }

                        let play_source: Result<PlaySource, WaveError> = {
                            let rodio_result = std::panic::catch_unwind(
                                std::panic::AssertUnwindSafe(|| {
                                    Decoder::new_mp4(
                                        Cursor::new(audio_bytes.clone()),
                                        rodio::decoder::Mp4Type::M4a,
                                    )
                                })
                            );
                            match rodio_result {
                                Ok(Ok(dec)) => {
                                    log::info!("rodio Decoder (m4a hint) succeeded — lazy decode");
                                    Ok(PlaySource::Rodio(dec))
                                }
                                Ok(Err(ref e)) => {
                                    log::warn!("rodio Decoder (m4a hint) error: {e} — falling back to direct symphonia");
                                    let fallback_bytes = audio_bytes.clone();
                                    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                        decode_with_symphonia(fallback_bytes)
                                    }))
                                    .unwrap_or_else(|_| Err(WaveError::Audio("symphonia panic".into())))
                                    .map(PlaySource::Pcm)
                                }
                                Err(_) => {
                                    log::warn!("rodio Decoder panicked — falling back to direct symphonia");
                                    let fallback_bytes = audio_bytes.clone();
                                    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                        decode_with_symphonia(fallback_bytes)
                                    }))
                                    .unwrap_or_else(|_| Err(WaveError::Audio("symphonia panic".into())))
                                    .map(PlaySource::Pcm)
                                }
                            }
                        };

                        match play_source {
                            Err(e) => {
                                log::error!("All decoders failed: {e}");
                                set_stopped(&shared_clone, &queue, volume);
                                let _ = result_tx.send(Err(e));
                            }
                            Ok(source) => {
                                match source {
                                    PlaySource::Rodio(dec) => start_sink(dec, &stream_handle, &mut sink, &mut current_track, &mut playback_started_at, track, &shared_clone, &queue, volume, &result_tx),
                                    PlaySource::Pcm(buf)   => start_sink(buf, &stream_handle, &mut sink, &mut current_track, &mut playback_started_at, track, &shared_clone, &queue, volume, &result_tx),
                                }
                            }
                        }
                    }

                    AudioCommand::PlayDecoded { mut samples, sample_rate, channels, track, result_tx } => {
                        if let Some(t) = current_track.take() {
                            history.push_back(t);
                            if history.len() > 50 { history.pop_front(); }
                        }
                        prepare_playback(&mut current_track, &mut sink, &mut playback_started_at, &mut paused_position, &shared_clone, &track, &queue, volume);
                        normalize_samples(&mut samples);
                        let sr = sample_rate.max(1);
                        let ch = channels.max(1);
                        let arc_samples = Arc::new(samples);
                        let pos = Arc::new(AtomicUsize::new(0));
                        current_pcm = Some(arc_samples.clone());
                        current_pos = Some(pos.clone());
                        current_sr = sr;
                        current_ch = ch;
                        let src = AtomicSeekSource::new(arc_samples, pos, sr, ch);
                        start_sink(src, &stream_handle, &mut sink, &mut current_track, &mut playback_started_at, track, &shared_clone, &queue, volume, &result_tx);
                        if let Some(ref s) = sink { s.set_speed(speed); }
                    }

                    AudioCommand::AppendChunk { samples, sample_rate, channels } => {
                        if let Some(ref s) = sink {
                            let sr = sample_rate.max(1);
                            let ch = channels.max(1);
                            let buf = rodio::buffer::SamplesBuffer::new(ch, sr, samples);
                            s.append(buf);
                            log::debug!("AppendChunk: queued tail samples sr={sr} ch={ch}");
                        }
                    }

                    AudioCommand::Pause => {
                        if let Some(ref s) = sink {
                            if !s.is_paused() {
                                if let Some(start) = playback_started_at.take() {
                                    paused_position += start.elapsed().as_secs_f64();
                                }
                                s.pause();
                                if let Ok(mut sh) = shared_clone.lock() {
                                    sh.state = PlaybackState::Paused;
                                    sh.current_track = current_track.clone();
                                    sh.position_secs = paused_position;
                                    sh.playing_since_unix_ms = None;
                                    sh.paused_at_secs = paused_position;
                                    sh.queue = queue.clone();
                                    sh.volume = volume;
                                }
                            }
                        }
                    }

                    AudioCommand::Resume => {
                        if let Some(ref s) = sink {
                            if s.is_paused() {
                                s.play();
                                playback_started_at = Some(Instant::now());
                                if let Ok(mut sh) = shared_clone.lock() {
                                    sh.state = PlaybackState::Playing;
                                    sh.current_track = current_track.clone();
                                    sh.position_secs = paused_position;
                                    sh.playing_since_unix_ms = Some(unix_now_ms());
                                    sh.paused_at_secs = paused_position;
                                    sh.queue = queue.clone();
                                    sh.volume = volume;
                                }
                            }
                        }
                    }

                    AudioCommand::Stop => {
                        if let Some(s) = sink.take() {
                            s.stop();
                        }
                        current_track = None;
                        current_pcm = None;
                        current_pos = None;
                        playback_started_at = None;
                        paused_position = 0.0;
                        if let Ok(mut sh) = shared_clone.lock() {
                            sh.state = PlaybackState::Stopped;
                            sh.current_track = None;
                            sh.position_secs = 0.0;
                            sh.playing_since_unix_ms = None;
                            sh.paused_at_secs = 0.0;
                            sh.queue = queue.clone();
                            sh.volume = volume;
                        }
                    }

                    AudioCommand::SetVolume(v) => {
                        volume = v.clamp(0.0, 1.0);
                        if let Some(ref s) = sink {
                            s.set_volume(volume);
                        }
                        let pos = paused_position
                            + playback_started_at
                                .map(|t| t.elapsed().as_secs_f64())
                                .unwrap_or(0.0);
                        let state = current_sink_state(&sink);
                        if let Ok(mut sh) = shared_clone.lock() {
                            sh.state = state;
                            sh.current_track = current_track.clone();
                            sh.position_secs = pos;
                            sh.queue = queue.clone();
                            sh.volume = volume;
                        }
                    }

                    AudioCommand::Seek(mut position_secs) => {
                        while let Ok(AudioCommand::Seek(newer)) = cmd_rx.try_recv() {
                            position_secs = newer;
                        }
                        if !position_secs.is_finite() || position_secs < 0.0 {
                            log::warn!("Seek: invalid position {position_secs}, ignoring");
                            return;
                        }

                        let sr = current_sr.max(1);
                        let ch = current_ch.max(1);

                        let (total_samples, target) = match current_pcm.as_ref() {
                            Some(pcm) => {
                                let frame_idx = (position_secs * sr as f64) as usize;
                                let sample_idx = (frame_idx * ch as usize).min(pcm.len());
                                let aligned = (sample_idx / ch as usize) * ch as usize;
                                let safe = if pcm.len() > ch as usize {
                                    aligned.min(pcm.len() - ch as usize)
                                } else { 0 };
                                (pcm.len(), safe)
                            }
                            None => {
                                log::warn!("Seek: no PCM cached, ignoring");
                                return;
                            }
                        };
                        let clamped_secs = (target as f64) / (sr as f64 * ch as f64);

                        let pos = match current_pos.as_ref() {
                            Some(p) => p.clone(),
                            None => { log::warn!("Seek: no atomic cursor, ignoring"); return; }
                        };
                        pos.store(target, Ordering::Relaxed);

                        let sink_finished = sink.as_ref()
                            .map(|s| s.empty())
                            .unwrap_or(true);
                        let was_playing_before = sink.as_ref()
                            .map(|s| !s.is_paused() && !s.empty())
                            .unwrap_or(false);

                        if sink_finished {
                            if let Some(pcm) = current_pcm.clone() {
                                if let Some(s) = sink.take() { drop(s); }
                                match Sink::try_new(&stream_handle) {
                                    Ok(s) => {
                                        s.set_volume(volume);
                                        s.set_speed(speed);
                                        let new_pos = Arc::new(AtomicUsize::new(target));
                                        current_pos = Some(new_pos.clone());
                                        s.append(AtomicSeekSource::new(pcm, new_pos, sr, ch));
                                        sink = Some(s);
                                        log::info!("Seek (revive) → {clamped_secs:.2}s / {} samples", total_samples);
                                    }
                                    Err(e) => log::error!("Seek revive: try_new failed: {e}"),
                                }
                            }
                        } else {
                            log::info!("Seek (atomic) → {clamped_secs:.2}s");
                        }

                        let now_playing = sink.as_ref()
                            .map(|s| !s.is_paused() && !s.empty())
                            .unwrap_or(was_playing_before);
                        paused_position = clamped_secs;
                        playback_started_at = if now_playing { Some(Instant::now()) } else { None };
                        if let Ok(mut sh) = shared_clone.lock() {
                            sh.state = if now_playing { PlaybackState::Playing } else { PlaybackState::Paused };
                            sh.current_track = current_track.clone();
                            sh.position_secs = clamped_secs;
                            sh.playing_since_unix_ms = if now_playing { Some(unix_now_ms()) } else { None };
                            sh.paused_at_secs = clamped_secs;
                            sh.queue = queue.clone();
                            sh.volume = volume;
                            sh.speed = speed;
                        }
                    }

                    AudioCommand::AddToQueue(track) => {
                        queue.push(track);
                        let pos = paused_position
                            + playback_started_at
                                .map(|t| t.elapsed().as_secs_f64())
                                .unwrap_or(0.0);
                        let state = current_sink_state(&sink);
                        if let Ok(mut sh) = shared_clone.lock() {
                            sh.state = state;
                            sh.current_track = current_track.clone();
                            sh.position_secs = pos;
                            sh.queue = queue.clone();
                            sh.volume = volume;
                        }
                    }

                    AudioCommand::ClearQueue => {
                        queue.clear();
                    }

                    AudioCommand::GetState { result_tx } => {
                        let pos = paused_position
                            + playback_started_at
                                .map(|t| t.elapsed().as_secs_f64())
                                .unwrap_or(0.0);
                        let state = current_sink_state(&sink);
                        let playing_since = if playback_started_at.is_some() { Some(unix_now_ms()) } else { None };
                        let speed = shared_clone.lock().map(|s| s.speed).unwrap_or(1.0);
                        let _ = result_tx.send(AudioStateSnapshot {
                            current_track: current_track.clone(),
                            state,
                            position_secs: pos,
                            playing_since_unix_ms: playing_since,
                            paused_at_secs: paused_position,
                            queue: queue.clone(),
                            volume,
                            speed,
                            shuffle,
                            repeat: repeat_mode.clone(),
                        });
                    }

                    AudioCommand::PopQueue { result_tx } => {
                        let next = if queue.is_empty() { None } else { Some(queue.remove(0)) };
                        let _ = result_tx.send(next);
                    }

                    AudioCommand::PopHistory { result_tx } => {
                        let track = history.pop_back();
                        let _ = result_tx.send(track);
                    }

                    AudioCommand::SetShuffle(v) => {
                        shuffle = v;
                        if shuffle && !queue.is_empty() {
                            use rand::seq::SliceRandom;
                            let mut rng = rand::thread_rng();
                            queue.shuffle(&mut rng);
                        }
                        if let Ok(mut s) = shared_clone.lock() {
                            s.shuffle = shuffle;
                        }
                    }

                    AudioCommand::SetRepeat(mode) => {
                        repeat_mode = mode.clone();
                        if let Ok(mut s) = shared_clone.lock() {
                            s.repeat = repeat_mode.clone();
                        }
                    }

                    AudioCommand::SetSpeed(s) => {
                        speed = s.clamp(0.25, 3.0);
                        if let Some(ref sink) = sink {
                            sink.set_speed(speed);
                        }
                        if let Ok(mut sh) = shared_clone.lock() {
                            sh.speed = speed;
                        }
                    }

                    AudioCommand::SetQueue(new_queue) => {
                        queue = new_queue;
                        let pos = paused_position
                            + playback_started_at
                                .map(|t| t.elapsed().as_secs_f64())
                                .unwrap_or(0.0);
                        let state = current_sink_state(&sink);
                        if let Ok(mut sh) = shared_clone.lock() {
                            sh.state = state;
                            sh.current_track = current_track.clone();
                            sh.position_secs = pos;
                            sh.queue = queue.clone();
                            sh.volume = volume;
                        }
                    }
                }
                    }));
                    if let Err(e) = result {
                        log::error!("Audio command panicked: {:?} — thread continuing", e);
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    let live = current_sink_state(&sink);
                    let cached = shared_clone.lock()
                        .map(|s| s.state.clone())
                        .unwrap_or(PlaybackState::Stopped);
                    if live != cached {
                        if let Ok(mut sh) = shared_clone.lock() {
                            sh.state = live.clone();
                        }
                        if matches!(live, PlaybackState::Stopped) {
                            log::info!("audio thread: detected natural end-of-song");
                            if let Some(t) = current_track.take() {
                                history.push_back(t);
                                if history.len() > 50 { history.pop_front(); }
                            }
                            current_pcm = None;
                            current_pos = None;
                            playback_started_at = None;
                            paused_position = 0.0;
                        }
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
        alive_clone.store(false, Ordering::SeqCst);
        log::error!("Audio thread exited");
    });

    AudioHandle { cmd_tx, shared, alive }
}

fn prepare_playback(
    current_track: &mut Option<Track>,
    sink: &mut Option<Sink>,
    playback_started_at: &mut Option<Instant>,
    paused_position: &mut f64,
    shared: &Arc<Mutex<AudioStateSnapshot>>,
    track: &Track,
    queue: &[Track],
    volume: f32,
) {
    let _ = current_track.take();
    if let Some(s) = sink.take() { s.stop(); }
    *playback_started_at = None;
    *paused_position = 0.0;

    if let Ok(mut s) = shared.lock() {
        s.state = PlaybackState::Loading;
        s.current_track = Some(track.clone());
        s.position_secs = 0.0;
        s.playing_since_unix_ms = None;
        s.paused_at_secs = 0.0;
        s.queue = queue.to_vec();
        s.volume = volume;
    }
}

fn start_sink<S>(
    source: S,
    stream_handle: &rodio::OutputStreamHandle,
    sink: &mut Option<Sink>,
    current_track: &mut Option<Track>,
    playback_started_at: &mut Option<Instant>,
    track: Track,
    shared: &Arc<Mutex<AudioStateSnapshot>>,
    queue: &[Track],
    volume: f32,
    result_tx: &std::sync::mpsc::SyncSender<Result<(), WaveError>>,
)
where
    S: rodio::Source + Send + 'static,
    S::Item: rodio::Sample + Send,
    f32: rodio::cpal::FromSample<S::Item>,
{
    match Sink::try_new(stream_handle) {
        Err(e) => {
            log::error!("Sink error: {e}");
            set_stopped(shared, queue, volume);
            let _ = result_tx.send(Err(WaveError::Audio(format!("Sink error: {e}"))));
        }
        Ok(s) => {
            s.set_volume(volume);
            s.append(source);
            *sink = Some(s);
            *current_track = Some(track);
            *playback_started_at = Some(Instant::now());

            if let Ok(mut sh) = shared.lock() {
                sh.state = PlaybackState::Playing;
                sh.current_track = current_track.clone();
                sh.position_secs = 0.0;
                sh.playing_since_unix_ms = Some(unix_now_ms());
                sh.paused_at_secs = 0.0;
                sh.queue = queue.to_vec();
                sh.volume = volume;
            }
            let _ = result_tx.send(Ok(()));
        }
    }
}

fn set_stopped(shared: &Arc<Mutex<AudioStateSnapshot>>, queue: &[Track], volume: f32) {
    if let Ok(mut s) = shared.lock() {
        s.state = PlaybackState::Stopped;
        s.current_track = None;
        s.position_secs = 0.0;
        s.playing_since_unix_ms = None;
        s.paused_at_secs = 0.0;
        s.queue = queue.to_vec();
        s.volume = volume;
    }
}

pub fn normalize_samples(samples: &mut Vec<i16>) {
    if samples.is_empty() { return; }
    let sum_sq: f64 = samples.iter().map(|&s| (s as f64 / 32768.0).powi(2)).sum();
    let rms = (sum_sq / samples.len() as f64).sqrt();
    if rms < 0.0001 { return; }

    const TARGET_RMS: f64 = 0.20;
    let gain = (TARGET_RMS / rms).min(3.0);

    for s in samples.iter_mut() {
        *s = ((*s as f64) * gain).clamp(-32768.0, 32767.0) as i16;
    }
}

fn current_sink_state(sink: &Option<Sink>) -> PlaybackState {
    match sink {
        None => PlaybackState::Stopped,
        Some(s) if s.empty() => PlaybackState::Stopped,
        Some(s) if s.is_paused() => PlaybackState::Paused,
        Some(_) => PlaybackState::Playing,
    }
}
