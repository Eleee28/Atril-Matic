use rustfft::{num_complex::Complex, FftPlanner};
use std::f64::consts::PI;
use std::sync::Arc;
use wasm_bindgen::prelude::*;

use crate::utils::{Note, SheetNote};

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

        self.apply_window(&mut samples);

        let mut buffer: Vec<Complex<f64>> = samples.iter().map(|&s| Complex::new(s, 0.0)).collect();

        self.fft.process(&mut buffer);

        self.spectrum = buffer;

        let (frequency, magnitude) = self.find_fundamental();

        if magnitude < 0.1 {
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
        // if magnitude < 0.1 {
        //     return JsValue::from_str(
        //         &serde_json::to_string(&serde_json::json!({
        //             "note": "None",
        //             "frequency": 0.0,
        //             "confidence": 0.0
        //         }))
        //         .unwrap_or_default(),
        //     );
        // }

        // // Find the closest musical note
        // let (note, octave) = crate::utils::Note::from_frequency(frequency);
        // let note_name = format!("{}{}", note.name(), octave);

        // JsValue::from_str(
        //     &serde_json::to_string(&serde_json::json!({
        //         "note": note_name,
        //         "frequency": frequency,
        //         "confidence": magnitude.min(1.0)
        //     }))
        //     .unwrap_or_default(),
        // )
    }
    //estandp sincero no estoy muy claro como funciona, simplemente copie la funcion y mappear la a los valores.
    fn apply_window(&self, samples: &mut [f64]) {
        let n = samples.len();
        for (i, sample) in samples.iter_mut().enumerate() {
            // Hanning window
            let window = 0.5 * (1.0 - (2.0 * PI * i as f64 / (n as f64 - 1.0)).cos());
            *sample *= window;
        }
    }

    fn find_fundamental(&self) -> (f64, f64) {
        let mut max_magnitude = 0.0;
        let mut max_index = 0;

        //(skip DC component at index 0)
        for i in 1..self.fft_size / 2 {
            let magnitude = self.spectrum[i].norm();
            if magnitude > max_magnitude {
                max_magnitude = magnitude;
                max_index = i;
            }
        }

        let frequency = max_index as f64 * self.sample_rate / self.fft_size as f64;

        if max_magnitude > 0.0 && frequency > 50.0 && frequency < 2000.0 {
            let (freq, mag) = self.harmonic_product_spectrum();
            if mag > max_magnitude * 0.8 {
                return (freq, mag);
            }
        }

        (frequency, max_magnitude)
    }

    fn harmonic_product_spectrum(&self) -> (f64, f64) {
        let mut hps = vec![0.0; self.fft_size / 2];

        for i in 0..self.fft_size / 2 {
            let mut product = self.spectrum[i].norm();
            let mut valid = true;

            for harmonic in 2..=3 {
                let idx = i * harmonic;
                if idx >= self.fft_size / 2 {
                    valid = false;
                    break;
                }
                product *= self.spectrum[idx].norm();
            }

            if valid {
                hps[i] = product;
            }
        }

        // Find max in HPS
        let mut max_magnitude = 0.0;
        let mut max_index = 0;
        for i in 1..self.fft_size / 4 {
            // Limit to lower frequencies for voice
            if hps[i] > max_magnitude {
                max_magnitude = hps[i];
                max_index = i;
            }
        }

        let frequency = max_index as f64 * self.sample_rate / self.fft_size as f64;
        (frequency, max_magnitude)
    }

    /// Helper to get FFT size
    pub fn get_fft_size(&self) -> usize {
        self.fft_size
    }
}
