//! A simple source of samples coming from a buffer.
//!
//! The `SamplesBuffer` struct can be used to treat a list of values as a `Source`.
//!
//! # Example
//!
//! ```
//! use rodio::buffer::SamplesBuffer;
//! let _ = SamplesBuffer::new(1, 44100, vec![1i16, 2, 3, 4, 5, 6]);
//! ```
//!

use std::time::Duration;

use crate::source::SeekError;
use crate::{Sample, Source};

/// A buffer of samples treated as a source.
pub struct SamplesBuffer<S> {
    data: Vec<S>,
    pos: usize,
    channels: u16,
    sample_rate: u32,
    duration: Duration,
}

impl<S> SamplesBuffer<S>
where
    S: Sample,
{
    /// Builds a new `SamplesBuffer`.
    ///
    /// # Panic
    ///
    /// - Panics if the number of channels is zero.
    /// - Panics if the samples rate is zero.
    /// - Panics if the length of the buffer is larger than approximately 16 billion elements.
    ///   This is because the calculation of the duration would overflow.
    ///
    pub fn new<D>(channels: u16, sample_rate: u32, data: D) -> SamplesBuffer<S>
    where
        D: Into<Vec<S>>,
    {
        assert!(channels != 0);
        assert!(sample_rate != 0);

        let data = data.into();
        let duration_ns = 1_000_000_000u64.checked_mul(data.len() as u64).unwrap()
            / sample_rate as u64
            / channels as u64;
        let duration = Duration::new(
            duration_ns / 1_000_000_000,
            (duration_ns % 1_000_000_000) as u32,
        );

        SamplesBuffer {
            data,
            pos: 0,
            channels,
            sample_rate,
            duration,
        }
    }
}

impl<S> Source for SamplesBuffer<S>
where
    S: Sample,
{
    #[inline]
    fn current_frame_len(&self) -> Option<usize> {
        None
    }

    #[inline]
    fn channels(&self) -> u16 {
        self.channels
    }

    #[inline]
    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    #[inline]
    fn total_duration(&self) -> Option<Duration> {
        Some(self.duration)
    }

    // this is fast because all the samples are in memory already
    // and due to the constant sample_rate we can jump to the right
    // sample directly
    //
    /// This jumps in memory till the sample for `pos`.
    #[inline]
    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        let channels = self.channels() as usize;
        // Use f64 to avoid precision loss for tracks longer than ~174 s at 96 kHz.
        // (f32 can only represent integers exactly up to 16_777_216; a 200-second
        //  stereo 48 kHz track has 19_200_000 samples — already beyond f32 precision.)
        let new_pos = (pos.as_secs_f64() * self.sample_rate() as f64 * channels as f64) as usize;
        // Saturate at the end of the buffer.
        let new_pos = new_pos.min(self.data.len());
        // Align DOWN to the nearest channel frame boundary.
        // Rounding *down* (not up with next_multiple_of) is critical: rounding up
        // can produce a position past data.len(), and the subsequent subtraction of
        // curr_channel would underflow (usize wraps → pos = usize::MAX → track
        // ends immediately, which the user sees as a "crash" on seek/skip-prev).
        let new_pos = (new_pos / channels.max(1)) * channels.max(1);
        self.pos = new_pos;
        Ok(())
    }
}

impl<S> Iterator for SamplesBuffer<S>
where
    S: Sample,
{
    type Item = S;

    #[inline]
    fn next(&mut self) -> Option<S> {
        let sample = self.data.get(self.pos)?;
        self.pos += 1;
        Some(*sample)
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        (self.data.len(), Some(self.data.len()))
    }
}

#[cfg(test)]
mod tests {
    use crate::buffer::SamplesBuffer;
    use crate::source::Source;

    #[test]
    fn basic() {
        let _ = SamplesBuffer::new(1, 44100, vec![0i16, 0, 0, 0, 0, 0]);
    }

    #[test]
    #[should_panic]
    fn panic_if_zero_channels() {
        SamplesBuffer::new(0, 44100, vec![0i16, 0, 0, 0, 0, 0]);
    }

    #[test]
    #[should_panic]
    fn panic_if_zero_sample_rate() {
        SamplesBuffer::new(1, 0, vec![0i16, 0, 0, 0, 0, 0]);
    }

    #[test]
    fn duration_basic() {
        let buf = SamplesBuffer::new(2, 2, vec![0i16, 0, 0, 0, 0, 0]);
        let dur = buf.total_duration().unwrap();
        assert_eq!(dur.as_secs(), 1);
        assert_eq!(dur.subsec_nanos(), 500_000_000);
    }

    #[test]
    fn iteration() {
        let mut buf = SamplesBuffer::new(1, 44100, vec![1i16, 2, 3, 4, 5, 6]);
        assert_eq!(buf.next(), Some(1));
        assert_eq!(buf.next(), Some(2));
        assert_eq!(buf.next(), Some(3));
        assert_eq!(buf.next(), Some(4));
        assert_eq!(buf.next(), Some(5));
        assert_eq!(buf.next(), Some(6));
        assert_eq!(buf.next(), None);
    }

    #[cfg(test)]
    mod try_seek {
        use super::*;
        use std::time::Duration;

        #[test]
        fn channel_order_stays_correct() {
            const SAMPLE_RATE: u32 = 100;
            const CHANNELS: u16 = 2;
            let mut buf = SamplesBuffer::new(
                CHANNELS,
                SAMPLE_RATE,
                (0..2000i16).into_iter().collect::<Vec<_>>(),
            );
            // Seeking always lands on channel 0 (left / even index) to prevent
            // usize underflow when curr_channel = 1 and new_pos = 0.
            buf.try_seek(Duration::from_secs(5)).unwrap();
            assert_eq!(
                buf.next(),
                Some(5i16 * SAMPLE_RATE as i16 * CHANNELS as i16) // = 1000 (left channel)
            );

            // Next two samples: right (odd) then left (even)
            assert!(buf.next().is_some_and(|s| s % 2 == 1)); // 1001 → right
            assert!(buf.next().is_some_and(|s| s % 2 == 0)); // 1002 → left

            // Seek again — always lands on left channel (even index)
            buf.try_seek(Duration::from_secs(6)).unwrap();
            assert!(buf.next().is_some_and(|s| s % 2 == 0), "seek must land on channel 0");
        }

        #[test]
        fn seek_to_zero_never_underflows() {
            // Regression test: old code did `new_pos - curr_channel` which underflowed
            // to usize::MAX when curr_channel=1 and new_pos=0, making the track end instantly.
            let mut buf = SamplesBuffer::new(2, 100, (0..200i16).collect::<Vec<_>>());
            // Advance past channel 0 so curr_channel would have been 1 in the old code
            let _ = buf.next(); // pos → 1 (channel 1)
            // This must NOT produce usize::MAX as pos
            buf.try_seek(std::time::Duration::ZERO).unwrap();
            assert_eq!(buf.next(), Some(0i16), "seek to 0 should reset to first sample");
        }
    }
}
