// For the browser console
pub mod note_track;
pub mod pitch_detector;
pub mod utils;

use log::{debug, error, warn};
use serde::Deserialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();

    #[cfg(feature = "debug-logs")]
    console_log::init_with_level(log::Level::Debug).expect("failed to initialize logger");

    //#[cfg(not(feature = "debug-logs"))]
    //console_log::init_with_level(log::Level::Warn)
    //	.expect("failed to initialize logger");
}

use crate::{
    note_track::{NoteTrack, NoteWindow},
    pitch_detector::PitchDetector,
    utils::SheetNote,
};

#[derive(Deserialize)]
struct InputSheetNote {
    note: String,
    start: u32,
    end: u32,
}

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

    pub fn add_track(&mut self, track: Vec<SheetNote>) {
        self.note_track.add_track(&track);
    }

    pub fn add_track_json(&mut self, notes_json: &str) -> Result<(), String> {
        // debug!("Received JSON: {}", notes_json)); // DEBUG

        let input_notes: Vec<InputSheetNote> =
            serde_json::from_str(notes_json).map_err(|error| error.to_string())?;

        let track: Result<Vec<SheetNote>, String> = input_notes
            .into_iter()
            .map(|input_note| {
                let note = parse_note_name(&input_note.note)?;

                Ok(SheetNote {
                    note,
                    start_time_ms: input_note.start,
                    end_time_ms: input_note.end,
                })
            })
            .collect();

        debug!("Received {} notes", track.clone()?.len()); // DEBUG

        for note in &track.clone()? {
            // DEBUG
            debug!(
                "{:?} octave={} start={} end={}",
                note.note.note_value, note.note.octave, note.start_time_ms, note.end_time_ms
            );
        }

        self.note_track.add_track(&track?);
        Ok(())
    }

    pub fn cursor_location_from_mic_input(&mut self, data: &[u8]) -> Option<u32> {
        debug!("Samples received: {}", data.len()); // DEBUG

        let note = self.pitch_detector.detect_pitch(data);

        match note.note_value {
            Some(note_value) => {
                debug!("Detected note: {:?}{}", note_value, note.octave);
                let note_window = NoteWindow { notes: vec![note] };
                self.note_track.push_query_slice(note_window);

                let position = self.note_track.match_position();
                match position {
                    Some(timestamp) => {
                        debug!("Matched cursor timestamp: {}", timestamp);
                    }
                    None => {
                        warn!("No cursor match found");
                    }
                }

                position
            }
            None => {
                warn!("No note detected");
                self.note_track.reset_break_flag();
                None
            }
        }
    }
}

fn parse_note_name(note_name: &str) -> Result<crate::utils::Note, String> {
    if note_name.len() < 2 {
        error!("Invalid note name: {}", note_name);
        return Err("Invalid note name".to_string());
    }

    let octave_start = note_name
        .find(|character: char| character.is_ascii_digit() || character == '-')
        .ok_or_else(|| "Note octave is missing".to_string())?;

    let (note_part, octave_part) = note_name.split_at(octave_start);

    let note_value = match note_part {
        "B#" | "C" => crate::utils::NoteValue::C,
        "B##" | "C#" | "Db" => crate::utils::NoteValue::CSharp,
        "C##" | "D" | "Ebb" => crate::utils::NoteValue::D,
        "D#" | "Eb" => crate::utils::NoteValue::DSharp,
        "D##" | "E" | "Fbb" => crate::utils::NoteValue::E,
        "E#" | "F" | "Gbb" => crate::utils::NoteValue::F,
        "E##" | "F#" | "Gb" => crate::utils::NoteValue::FSharp,
        "F##" | "G" | "Abb" => crate::utils::NoteValue::G,
        "G#" | "Ab" => crate::utils::NoteValue::GSharp,
        "G##" | "A" | "Bbb" => crate::utils::NoteValue::A,
        "A#" | "Bb" | "Cbb" => crate::utils::NoteValue::ASharp,
        "A##" | "B" | "Cb" => crate::utils::NoteValue::B,
        _ => {
            error!("Invalid note value: {}", note_part);
            return Err(format!("Invalid note value: {}", note_part));
        }
    };

    let octave = octave_part
        .parse::<i32>()
        .map_err(|_| "Invalid note octave".to_string())?;

    Ok(crate::utils::Note {
        note_value: Some(note_value),
        octave,
    })
}

#[cfg(not(target_arch = "wasm32"))]
pub fn init_logger() {
    let _ = env_logger::builder().is_test(cfg!(test)).try_init();
}

#[cfg(target_arch = "wasm32")]
pub fn init_logger() {
    let _ = console_log::init_with_level(log::Level::Debug);
}
