use rustfft::{num_complex::Complex, FftPlanner};
use std::f64::consts::PI;
use std::sync::Arc;
use wasm_bindgen::prelude::*;

// Musical notes (A4 = 440Hz)
const NOTES: [(&str, f64); 12] = [
    ("C", 16.35),
    ("C#", 17.32),
    ("D", 18.35),
    ("D#", 19.45),
    ("E", 20.60),
    ("F", 21.83),
    ("F#", 23.12),
    ("G", 24.50),
    ("G#", 25.96),
    ("A", 27.50),
    ("A#", 29.14),
    ("B", 30.87),
];

#[wasm_bindgen]
pub struct AudioProcessor {
    sample_rate: f64,
    fft_size: usize,
    fft: Arc<dyn rustfft::Fft<f64>>,
    spectrum: Vec<Complex<f64>>,
}

#[wasm_bindgen]
impl AudioProcessor {
    pub fn new(sample_rate: f64, fft_size: usize) -> AudioProcessor {
        let mut planner = FftPlanner::<f64>::new();
        let fft = planner.plan_fft_forward(fft_size);

        AudioProcessor {
            sample_rate,
            fft_size,
            fft,
            spectrum: vec![Complex::new(0.0, 0.0); fft_size],
        }
    }

    pub fn detect_pitch(&mut self, time_domain_data: &[u8]) -> JsValue {
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
            return JsValue::from_str(
                &serde_json::to_string(&serde_json::json!({
                    "note": "None",
                    "frequency": 0.0,
                    "confidence": 0.0
                }))
                .unwrap_or_default(),
            );
        }

        // Find the closest musical note
        let note_name = self.frequency_to_note(frequency);

        JsValue::from_str(
            &serde_json::to_string(&serde_json::json!({
                "note": note_name,
                "frequency": frequency,
                "confidence": magnitude.min(1.0)
            }))
            .unwrap_or_default(),
        )
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

    fn frequency_to_note(&self, frequency: f64) -> String {
        if frequency < 50.0 || frequency > 2000.0 {
            return "None".to_string();
        }

        let midi_note = 12.0 * (frequency / 440.0).log2() + 69.0;
        let midi_rounded = (midi_note + 0.5).round() as i32;
        let octave = (midi_rounded / 12) - 1;
        let note_index = ((midi_rounded % 12) + 12) % 12;

        format!("{}{}", NOTES[note_index as usize].0, octave)
    }

    /// Helper to get FFT size
    pub fn get_fft_size(&self) -> usize {
        self.fft_size
    }
}

// For the browser console
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

//https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getByteTimeDomainData
// https://chat.deepseek.com/a/chat/s/54cc8132-113f-4cd4-985e-7844bedcabe0
//https://docs.google.com/document/d/18WST5JSrPt2_M_YojyVxcHNxLLa47Qzjq4wKrzf3GkE/edit?tab=t.0

//USE:
//wasm-pack build --target web   to build
//run surver on http://localhost:3000/www/
// with command npm start
