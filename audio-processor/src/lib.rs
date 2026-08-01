// For the browser console
pub mod note_track;
pub mod pitch_detector;
pub mod utils;
use wasm_bindgen::prelude::*;

use crate::{note_track::NoteTrack, pitch_detector::PitchDetector};
#[wasm_bindgen]
pub struct AudioProcessor {
    pitch_detector: PitchDetector,
    note_track: NoteTrack,
}
#[wasm_bindgen]
impl AudioProcessor {
    pub fn new(sample_rate: f64, fft_size: usize) -> AudioProcessor {
        AudioProcessor {
            pitch_detector: PitchDetector::new(sample_rate, fft_size),
            note_track: NoteTrack {},
        }
    }
    pub fn cursor_location_from_mic_input(&mut self, time_domain_data: &[u8]) {
        let note_played = self.pitch_detector.detect_pitch(time_domain_data);
    }
}
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}
