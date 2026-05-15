
use std::sync::{Arc, Mutex};
use rodio::Source;

pub const BAND_FREQS: [f32; 5] = [60.0, 250.0, 1000.0, 4000.0, 8000.0];
pub const BAND_NAMES: [&str; 5] = ["Sub", "Bass", "Mid", "Hi-Mid", "Air"];

#[derive(Clone)]
pub struct EqSettings {
    inner: Arc<Mutex<[f32; 5]>>,
}

impl EqSettings {
    pub fn new() -> Self {
        Self { inner: Arc::new(Mutex::new([0.0; 5])) }
    }

    pub fn get(&self) -> [f32; 5] {
        *self.inner.lock().unwrap()
    }

    pub fn set_band(&self, band: usize, db: f32) {
        if band < 5 {
            self.inner.lock().unwrap()[band] = db.clamp(-12.0, 12.0);
        }
    }

    pub fn set_all(&self, bands: [f32; 5]) {
        let mut g = self.inner.lock().unwrap();
        for (i, db) in bands.iter().enumerate() {
            g[i] = db.clamp(-12.0, 12.0);
        }
    }
}

pub const PRESETS: &[(&str, [f32; 5])] = &[
    ("Flat",         [ 0.0,  0.0,  0.0,  0.0,  0.0]),
    ("Bass Boost",   [ 6.0,  4.0,  0.0, -1.0, -2.0]),
    ("Vocal",        [-2.0, -1.0,  3.0,  4.0,  1.0]),
    ("Acoustic",     [ 2.0,  3.0,  1.0,  2.0,  3.0]),
    ("Electronic",   [ 4.0,  2.0, -2.0,  1.0,  4.0]),
    ("Treble Boost", [-2.0, -1.0,  0.0,  3.0,  6.0]),
    ("Loudness",     [ 5.0,  2.0, -1.0,  2.0,  5.0]),
];

#[derive(Clone, Copy, Default)]
struct BiquadState {
    x1: f32, x2: f32, y1: f32, y2: f32,
}

#[derive(Clone, Copy)]
struct BiquadCoeffs {
    b0: f32, b1: f32, b2: f32, a1: f32, a2: f32,
}

impl BiquadCoeffs {
    fn peaking(freq: f32, sample_rate: f32, db_gain: f32, q: f32) -> Self {
        let a = 10.0_f32.powf(db_gain / 40.0);
        let w0 = 2.0 * std::f32::consts::PI * freq / sample_rate;
        let alpha = w0.sin() / (2.0 * q);
        let b0 = 1.0 + alpha * a;
        let b1 = -2.0 * w0.cos();
        let b2 = 1.0 - alpha * a;
        let a0 = 1.0 + alpha / a;
        let a1 = -2.0 * w0.cos();
        let a2 = 1.0 - alpha / a;
        Self {
            b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
            a1: a1 / a0, a2: a2 / a0,
        }
    }

    fn process(&self, x: f32, state: &mut BiquadState) -> f32 {
        let y = self.b0 * x + self.b1 * state.x1 + self.b2 * state.x2
              - self.a1 * state.y1 - self.a2 * state.y2;
        state.x2 = state.x1; state.x1 = x;
        state.y2 = state.y1; state.y1 = y;
        y
    }
}

pub struct EqSource<S> {
    inner: S,
    settings: EqSettings,
    states: Vec<Vec<BiquadState>>,
    channel_idx: usize,
}

impl<S> EqSource<S>
where
    S: Source<Item = f32>,
{
    pub fn new(source: S, settings: EqSettings) -> Self {
        let channels = source.channels() as usize;
        let states = vec![vec![BiquadState::default(); channels.max(1)]; 5];
        Self { inner: source, settings, states, channel_idx: 0 }
    }
}

impl<S> Iterator for EqSource<S>
where
    S: Source<Item = f32>,
{
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        let sample = self.inner.next()?;
        let gains = self.settings.get();
        let ch = self.channel_idx % self.states[0].len().max(1);
        let sr = self.inner.sample_rate() as f32;

        let mut out = sample;
        for band in 0..5 {
            if gains[band].abs() > 0.1 {
                let coeffs = BiquadCoeffs::peaking(BAND_FREQS[band], sr, gains[band], 0.707);
                out = coeffs.process(out, &mut self.states[band][ch]);
            }
        }

        self.channel_idx += 1;
        Some(out.clamp(-1.0, 1.0))
    }
}

impl<S> Source for EqSource<S>
where
    S: Source<Item = f32>,
{
    fn current_frame_len(&self) -> Option<usize> { self.inner.current_frame_len() }
    fn channels(&self) -> u16 { self.inner.channels() }
    fn sample_rate(&self) -> u32 { self.inner.sample_rate() }
    fn total_duration(&self) -> Option<std::time::Duration> { self.inner.total_duration() }
}
