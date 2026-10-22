use crate::log;
use num_complex::ComplexFloat;
use rustfft::num_traits::clamp;
use rustfft::{num_complex::Complex, FftPlanner};
use std::f64::consts::PI;
use std::sync::Arc;
use wasm_bindgen::prelude::*;

use crate::utils::Note;
const THRESHOLD_ACCEPT_MAG: f64 = 10.0;
const MAX_HARMONIC_DIVISOR: usize = 4;
const SUB_HARMONIC_THRESHOLD: f64 = 0.5;
const MIN_FUNDAMENTAL_HZ: f64 = 40.0;
const MAX_FUNDAMENTAL_HZ: f64 = 4500.0;

// Musical notes (A4 = 440Hz)

#[wasm_bindgen]
pub struct PitchDetector {
    sample_rate: f64,
    fft_size: usize,
    fft: Arc<dyn rustfft::Fft<f64>>,
    spectrum: Vec<Complex<f64>>,
}

impl PitchDetector {
    pub fn new(sample_rate: f64, fft_size: usize) -> PitchDetector {
        let mut planner = FftPlanner::<f64>::new();
        let fft = planner.plan_fft_forward(fft_size);

        PitchDetector {
            sample_rate,
            fft_size,
            fft,
            spectrum: vec![Complex::new(0.0, 0.0); fft_size],
        }
    }

    pub fn detect_pitch(&mut self, time_domain_data: &[u8]) -> Note {
        // Convert byte data to float samples (0-255 to -1.0 to 1.0)
        let mut samples: Vec<f64> = time_domain_data
            .iter()
            .map(|&byte| (byte as f64 - 128.0) / 128.0)
            .collect();

        self.apply_hann_window(&mut samples);

        let mut buffer: Vec<Complex<f64>> = samples.iter().map(|&s| Complex::new(s, 0.0)).collect();

        self.fft.process(&mut buffer);

        self.spectrum = buffer;
        let (frequency, magnitude) = self.find_fundamental();
        log(&format!(
            "frequency: {}hz magnitude:{}",
            frequency, magnitude
        ));

        if magnitude < THRESHOLD_ACCEPT_MAG {
            return Note {
                note_value: None,
                octave: 0,
            };
        }
        let (note_val, octave) = crate::utils::NoteValue::from_frequency(frequency);
        return Note {
            note_value: Some(note_val),
            octave,
        };
    }

    // Reduces spectral leakage and is necessary for the Granke algorithm
    fn apply_hann_window(&self, samples: &mut [f64]) {
        let n = samples.len();
        for (i, sample) in samples.iter_mut().enumerate() {
            // Hanning window
            let window = 0.5 * (1.0 - (2.0 * PI * i as f64 / (n as f64 - 1.0)).cos());
            *sample *= window;
        }
    }

    fn find_fundamental(&self) -> (f64, f64) {
        let bin_width = self.sample_rate / self.fft_size as f64;

        // Restrict the search to the vocal band. Skipping the sub-bass bins is
        // what stops drums/rumble (~20-60 Hz) from being detected as a note.
        let min_bin = ((MIN_FUNDAMENTAL_HZ / bin_width).floor() as usize).max(2);
        let max_bin = ((MAX_FUNDAMENTAL_HZ / bin_width).ceil() as usize).min(self.fft_size / 2 - 1);

        let mut max_magnitude = 0.0;
        let mut max_index = 0;
        for i in min_bin..max_bin {
            let magnitude = self.spectrum[i].norm();
            if magnitude > max_magnitude {
                max_magnitude = magnitude;
                max_index = i;
            }
        }

        if max_magnitude <= 0.0 {
            return (0.0, 0.0);
        }

        let (best_sub_bin, best_sub_magnitude) = self.best_sub_bin_and_mag(max_index, min_bin);
        if best_sub_bin > 0 && best_sub_magnitude > max_magnitude * SUB_HARMONIC_THRESHOLD {
            let delta = self.granke_estimator(max_index);
            let f_estimated = (best_sub_bin as f64 + delta) * bin_width;
            return (f_estimated, best_sub_magnitude);
        }
        // f_estimated = (k + δ) * fs / N
        // k = integer index of the peak bin from argmax / find_peaks (the bin you'd naively report)
        //δ = the fractional offset Quinn returns
        //fs = sample rate (48000khz)
        //N = FFT size (2048)
        let delta = self.granke_estimator(max_index);
        let f_estimated = (max_index as f64 + delta) * bin_width;
        (f_estimated, max_magnitude)
    }
    // Sub-harmonic correction: the FFT peak is often the 2nd or 3rd harmonic
    // of the true fundamental (e.g. guitar sustain), so the reported note can
    // be an octave (or more) above what was actually played. If a
    // (near-)integer sub-multiple of the peak bin also carries strong energy,
    // report that lower bin as the fundamental instead.
    fn best_sub_bin_and_mag(&self, max_index: usize, min_bin: usize) -> (usize, f64) {
        let mut best_sub_magnitude = 0.0;
        let mut best_sub_bin_index = 0usize;
        for k in 2..=MAX_HARMONIC_DIVISOR {
            let sub_bin = (max_index as f64 / k as f64).round() as usize;
            if sub_bin < min_bin || sub_bin >= max_index {
                continue;
            }
            let sub = self.spectrum[sub_bin].norm();
            if sub > best_sub_magnitude {
                best_sub_magnitude = sub;
                best_sub_bin_index = sub_bin;
            }
        }
        (best_sub_bin_index, best_sub_magnitude)
    }
    //returns bit offset of the interpolation,
    // f_estimated = (k + δ) * fs / N
    // k = integer index of the peak bin from argmax / find_peaks (the bin you'd naively report)
    //δ = the fractional offset Quinn returns (e.g. -0.23, +0.11)
    //fs = sample rate (48000khz)
    //N = FFT size (2048)
    // similar to the Quin estimator but already made to be used with the Hann window. Low spectral leakage and
    fn granke_estimator(&self, peak_index: usize) -> f64 {
        let left = self.spectrum[peak_index - 1].norm();
        let center = self.spectrum[peak_index].norm();
        let right = self.spectrum[peak_index + 1].norm();
        let denom = left + 2.0 * center + right;

        if denom == 0.0 {
            0.0
        } else {
            (2.0 * (right - left) / denom).clamp(-0.5, 0.5)
        }
    }
    /// Helper to get FFT size
    pub fn get_fft_size(&self) -> usize {
        self.fft_size
    }
}
