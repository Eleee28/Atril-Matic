use log::debug;
use rustfft::{num_complex::Complex, FftPlanner};
use std::f64::consts::PI;
use std::sync::Arc;
use wasm_bindgen::prelude::*;

use crate::config::{AudioConfig, WindowFunction};
use crate::utils::Note;

pub struct DetectedPitch {
	pub note: Note,
	pub frequency: Option<f64>,
	pub magnitude: f64,
}

#[wasm_bindgen]
pub struct PitchDetector {
    fft: Arc<dyn rustfft::Fft<f64>>,
    spectrum: Vec<Complex<f64>>,

	config: AudioConfig,
}

impl PitchDetector {
    pub fn new(config: AudioConfig) -> PitchDetector {
        let mut planner = FftPlanner::<f64>::new();
        let fft = planner.plan_fft_forward(config.fft_size);

        PitchDetector {
            fft,
            spectrum: vec![Complex::new(0.0, 0.0); config.fft_size],
			config
        }
    }

    pub fn detect_pitch(&mut self, time_domain_data: &[u8]) -> Note {
        self.detect_pitch_details(time_domain_data).note
    }

	pub fn detect_pitch_details(&mut self, time_domain_data: &[u8]) -> DetectedPitch {
		// Convert byte data to float samples (0-255 to -1.0 to 1.0)
        let mut samples: Vec<f64> = time_domain_data
            .iter()
            .map(|&byte| (byte as f64 - 128.0) / 128.0)
            .collect();

        self.apply_window(&mut samples);

        let mut buffer: Vec<Complex<f64>> = samples.iter().map(|&s| Complex::new(s, 0.0)).collect();

        self.fft.process(&mut buffer);

        self.spectrum = buffer;
        let (frequency, magnitude) = self.find_fundamental();
        debug!("frequency: {}hz magnitude:{}", frequency, magnitude);

        if magnitude < self.config.magnitude_threshold {
			return DetectedPitch { 
				note: Note {
					note_value: None,
					octave: 0,
				},
				frequency: Some(frequency),
				magnitude,
			};
        }
        let (note_val, octave) = crate::utils::NoteValue::from_frequency(frequency);

		return DetectedPitch { 
			note: Note {
				note_value: Some(note_val),
				octave,
			},
			frequency: Some(frequency),
			magnitude
		};
	}

    //TODO: (delete comment) estandp sincero no estoy muy claro como funciona, simplemente copie la funcion y mappear la a los valores.
    fn apply_window(&self, samples: &mut [f64]) { // TODO: posibility to use Hann, Rectangular, Hamming and Blackman window functions
        let n = samples.len();
        for (i, sample) in samples.iter_mut().enumerate() {
            // Hanning window
            let window = 0.5 * (1.0 - (2.0 * PI * i as f64 / (n as f64 - 1.0)).cos());
            *sample *= window;
        }
    }

	fn window_coefficient(function: &WindowFunction, index: usize, size: usize) -> f32 {
		// Implement rectangular, hann, hamming and blackman equations (switch case on function)
		todo!()
	}

    fn find_fundamental(&self) -> (f64, f64) {
        let bin_width = self.config.sample_rate / self.config.fft_size as f64;

        // Restrict the search to the vocal band. Skipping the sub-bass bins is
        // what stops drums/rumble (~20-60 Hz) from being detected as a note.
        let min_bin = (self.config.min_frequency / bin_width).floor().max(1.0) as usize;
        let max_bin = ((self.config.max_frequency / bin_width).ceil() as usize).min(self.config.fft_size / 2);

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

        // Sub-harmonic correction: the FFT peak is often the 2nd or 3rd harmonic
        // of the true fundamental (e.g. guitar sustain), so the reported note can
        // be an octave (or more) above what was actually played. If a
        // (near-)integer sub-multiple of the peak bin also carries strong energy,
        // report that lower bin as the fundamental instead.
        let mut best_sub_magnitude = 0.0;
        let mut best_sub_bin = 0usize;
        for k in 2..= self.config.max_harmonic_divisor {
            let sub_bin = (max_index as f64 / k as f64).round() as usize;
            if sub_bin < min_bin || sub_bin >= max_index {
                continue;
            }
            let sub = self.spectrum[sub_bin].norm();
            if sub > best_sub_magnitude {
                best_sub_magnitude = sub;
                best_sub_bin = sub_bin;
            }
        }
        if best_sub_bin > 0 && best_sub_magnitude > max_magnitude * self.config.subharmonic_threshold {
            return (best_sub_bin as f64 * bin_width, best_sub_magnitude);
        }

        (max_index as f64 * bin_width, max_magnitude)
    }

    /// Helper to get FFT size
    pub fn get_fft_size(&self) -> usize {
        self.config.fft_size
    }
}
