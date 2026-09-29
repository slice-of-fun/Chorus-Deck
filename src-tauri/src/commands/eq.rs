use biquad::{Biquad, Coefficients, DirectForm2Transposed, ToHertz, Type, Q_BUTTERWORTH_F32};
use rodio::Source;
use std::sync::mpsc::Receiver;

pub enum EqCommand {
    Bypass(bool),
    Band { frequency: f32, gain: f32 },
}

const FREQUENCIES: [f32; 10] = [
    31.0, 62.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0,
];

fn get_band_index(freq: f32) -> Option<usize> {
    FREQUENCIES.iter().position(|&f| (f - freq).abs() < 1.0)
}

fn make_biquad(fs: f32, freq: f32, gain: f32) -> DirectForm2Transposed<f32> {
    let f0 = freq.hz();
    let q = Q_BUTTERWORTH_F32;
    let coeffs = Coefficients::<f32>::from_params(Type::PeakingEQ(gain), fs.hz(), f0, q)
        .unwrap_or_else(|_| {
            Coefficients::<f32>::from_params(Type::PeakingEQ(0.0), fs.hz(), f0, q).unwrap()
        });
    DirectForm2Transposed::<f32>::new(coeffs)
}

pub struct EqSource<I> {
    inner: I,
    channels: u16,
    sample_rate: u32,
    bypass: bool,
    rx: Receiver<EqCommand>,

    // Per channel, a vec of 10 biquads
    filters: Vec<Vec<DirectForm2Transposed<f32>>>,
    gains: [f32; 10],

    current_channel: usize,
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

        Self {
            inner,
            channels,
            sample_rate,
            bypass: false,
            rx,
            filters,
            gains: [0.0; 10],
            current_channel: 0,
        }
    }

    fn process_commands(&mut self) {
        while let Ok(cmd) = self.rx.try_recv() {
            match cmd {
                EqCommand::Bypass(b) => {
                    self.bypass = b;
                }
                EqCommand::Band { frequency, gain } => {
                    if let Some(idx) = get_band_index(frequency) {
                        self.gains[idx] = gain;
                        let fs = self.sample_rate as f32;
                        // update filters for all channels
                        for ch in 0..self.channels as usize {
                            if ch < self.filters.len() {
                                self.filters[ch][idx] = make_biquad(fs, FREQUENCIES[idx], gain);
                            }
                        }
                    }
                }
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
        self.process_commands();

        let mut sample = self.inner.next()?;

        if !self.bypass && self.channels > 0 {
            // Apply all 10 bands for the current channel
            if self.current_channel < self.filters.len() {
                for idx in 0..10 {
                    // Only process if gain is not 0.0
                    if self.gains[idx].abs() > 0.01 {
                        sample = self.filters[self.current_channel][idx].run(sample);
                    }
                }
            }
        }

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
}
