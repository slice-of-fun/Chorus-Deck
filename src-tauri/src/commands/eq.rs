use biquad::{Biquad, Coefficients, DirectForm2Transposed, ToHertz, Type};
use rodio::source::SeekError;
use rodio::Source;
use std::sync::mpsc::{Receiver, TryRecvError};

pub enum EqCommand {
    Bypass(bool),
    Band { frequency: f32, gain: f32 },
}

pub const FREQUENCIES: [f32; 10] = [
    31.0, 62.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0,
];
const EQ_Q: f32 = 1.41;
const COMMAND_DRAIN_INTERVAL: u32 = 64;
const MAX_BOOST_DB: f32 = 12.0;
const OUTPUT_CEILING: f32 = 0.891;
const MAKEUP_TAU_SECONDS: f32 = 0.05;
const CLIP_KNEE: f32 = 0.8;
fn soft_clip(sample: f32) -> f32 {
    if sample.abs() <= CLIP_KNEE {
        return sample;
    }

    let sign = if sample < 0.0 { -1.0 } else { 1.0 };
    let over = sample.abs() - CLIP_KNEE;
    let span = OUTPUT_CEILING - CLIP_KNEE;

    sign * (CLIP_KNEE + span * (over / span).tanh())
}

fn get_band_index(freq: f32) -> Option<usize> {
    FREQUENCIES.iter().position(|&f| (f - freq).abs() < 1.0)
}

fn band_coefficients(fs: f32, freq: f32, gain: f32) -> Coefficients<f32> {
    let sample_rate = fs.hz();
    let f0 = freq.hz();
    Coefficients::<f32>::from_params(Type::PeakingEQ(gain), sample_rate, f0, EQ_Q).unwrap_or_else(
        |_| Coefficients::<f32>::from_params(Type::PeakingEQ(0.0), sample_rate, f0, EQ_Q).unwrap(),
    )
}

fn make_biquad(fs: f32, freq: f32, gain: f32) -> DirectForm2Transposed<f32> {
    DirectForm2Transposed::<f32>::new(band_coefficients(fs, freq, gain))
}

pub struct EqSource<I> {
    inner: I,
    channels: u16,
    sample_rate: u32,
    bypass: bool,
    rx: Receiver<EqCommand>,
    filters: Vec<Vec<DirectForm2Transposed<f32>>>,
    gains: [f32; 10],
    makeup_target: f32,
    makeup: f32,
    makeup_coeff: f32,
    current_channel: usize,
    since_command_drain: u32,
}

impl<I> EqSource<I>
where
    I: Source<Item = f32>,
{
    pub fn new(inner: I, rx: Receiver<EqCommand>) -> Self {
        let channels = inner.channels();
        let sample_rate = inner.sample_rate();
        let fs = sample_rate as f32;

        let mut filters = Vec::new();
        for _ in 0..channels {
            let mut channel_filters = Vec::new();
            for &freq in &FREQUENCIES {
                channel_filters.push(make_biquad(fs, freq, 0.0));
            }
            filters.push(channel_filters);
        }

        let makeup_coeff = 1.0 - (-1.0 / (MAKEUP_TAU_SECONDS * fs.max(1.0))).exp();

        Self {
            inner,
            channels,
            sample_rate,
            bypass: false,
            rx,
            filters,
            gains: [0.0; FREQUENCIES.len()],
            makeup_target: 1.0,
            makeup: 1.0,
            makeup_coeff,
            current_channel: 0,
            since_command_drain: 0,
        }
    }

    fn update_makeup(&mut self) {
        let loudest = self
            .gains
            .iter()
            .copied()
            .fold(0.0_f32, |acc, g| acc.max(g))
            .clamp(0.0, MAX_BOOST_DB);

        self.makeup_target = 10.0_f32.powf(-loudest / 20.0);
    }

    fn apply_band(&mut self, idx: usize, gain: f32) {
        self.gains[idx] = gain;
        let coeffs = band_coefficients(self.sample_rate as f32, FREQUENCIES[idx], gain);
        for ch in 0..self.channels as usize {
            if let Some(band) = self.filters.get_mut(ch).and_then(|f| f.get_mut(idx)) {
                band.update_coefficients(coeffs);
            }
        }
        self.update_makeup();
    }

    fn reset_filter_state(&mut self) {
        for channel in &mut self.filters {
            for filter in channel {
                filter.reset_state();
            }
        }
    }

    fn process_commands(&mut self) {
        loop {
            match self.rx.try_recv() {
                Ok(EqCommand::Bypass(b)) => {
                    if self.bypass != b {
                        self.reset_filter_state();
                    }
                    self.bypass = b;
                }
                Ok(EqCommand::Band { frequency, gain }) => {
                    if let Some(idx) = get_band_index(frequency) {
                        self.apply_band(idx, gain);
                    }
                }
                Err(TryRecvError::Empty) | Err(TryRecvError::Disconnected) => break,
            }
        }
    }
}

impl<I> Iterator for EqSource<I>
where
    I: Source<Item = f32>,
{
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.since_command_drain == 0 {
            self.process_commands();
            self.since_command_drain = COMMAND_DRAIN_INTERVAL;
        } else {
            self.since_command_drain -= 1;
        }

        let mut sample = self.inner.next()?;

        if !self.bypass && self.channels > 0 {
            if self.current_channel < self.filters.len() {
                for idx in 0..FREQUENCIES.len() {
                    sample = self.filters[self.current_channel][idx].run(sample);
                }
            }

            self.makeup += (self.makeup_target - self.makeup) * self.makeup_coeff;
            sample *= self.makeup;
        }

        sample = soft_clip(sample);

        self.current_channel = (self.current_channel + 1) % (self.channels as usize);

        Some(sample)
    }
}

impl<I> Source for EqSource<I>
where
    I: Source<Item = f32>,
{
    fn current_frame_len(&self) -> Option<usize> {
        self.inner.current_frame_len()
    }

    fn channels(&self) -> u16 {
        self.channels
    }

    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn total_duration(&self) -> Option<std::time::Duration> {
        self.inner.total_duration()
    }

    fn try_seek(&mut self, to: std::time::Duration) -> Result<(), SeekError> {
        self.inner.try_seek(to)?;
        self.current_channel = 0;
        self.reset_filter_state();
        Ok(())
    }
}

