// For the browser console
pub mod note_track;
pub mod pitch_detector;
pub mod utils;
use wasm_bindgen::prelude::*;

use crate::{note_track::NoteTrack, pitch_detector::PitchDetector, utils::SheetNote};
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
            note_track: NoteTrack::new(),
        }
    }
    pub fn add_track_to_notetrack(&mut self, track: Vec<SheetNote>) {
        self.note_track.add_track(&track);
    }
    pub fn cursor_location_from_mic_input(&mut self, data: &[u8]) -> Option<u32> {
        let note = self.pitch_detector.detect_pitch(data);
        let slice = match note.note_value {
            Some(_) => vec![note],
            None => Vec::new(),
        };
        self.note_track.push_query_slice(slice);
        self.note_track.match_position()
    }
}
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}
