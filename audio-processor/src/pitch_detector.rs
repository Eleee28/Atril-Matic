use crate::log;
use rustfft::{num_complex::Complex, FftPlanner};
use std::f64::consts::PI;
use std::sync::Arc;
use wasm_bindgen::prelude::*;

use crate::utils::Note;
const THRESHOLD_ACCEPT_MAG: f64 = 10.0;
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
        let bin_width = self.sample_rate / self.fft_size as f64;

        // Restrict the search to the vocal band. Skipping the sub-bass bins is
        // what stops drums/rumble (~20-60 Hz) from being detected as a note.
        let min_bin = (60.0 / bin_width).round().max(1.0) as usize;
        let max_bin = ((2000.0 / bin_width).round() as usize).min(self.fft_size / 2);

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

        // Octave correction: the FFT peak is often the 2nd harmonic, so the true
        // fundamental is one octave lower. If half the peak bin also has strong
        // energy, report that lower octave instead.
        if max_index % 2 == 0 {
            let sub = self.spectrum[max_index / 2].norm();
            if sub > max_magnitude * 0.5 {
                return (max_index as f64 / 2.0 * bin_width, sub);
            }
        }

        (max_index as f64 * bin_width, max_magnitude)
    }

    /// Helper to get FFT size
    pub fn get_fft_size(&self) -> usize {
        self.fft_size
    }
}
