// For the browser console
pub mod note_track;
pub mod pitch_detector;
pub mod utils;

use serde::Deserialize;
use wasm_bindgen::prelude::*;

use crate::{note_track::NoteTrack, pitch_detector::PitchDetector, utils::SheetNote};

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
	
	pub fn add_track_json(&mut self, notes_json: &str) -> Result<(), JsValue> {
		log(&format!("Received JSON: {}", notes_json)); // DEBUG

		let input_notes: Vec<InputSheetNote> = serde_json::from_str(notes_json).map_err(|error| JsValue::from_str(&error.to_string()))?;

		let track: Result<Vec<SheetNote>, JsValue> = input_notes.into_iter().map(|input_note| {
			let note = parse_note_name(&input_note.note)?;

			Ok(SheetNote {
				note,
				start_time_ms: input_note.start,
				end_time_ms: input_note.end,
			})
		}).collect();

		log(&format!("Received {} notes", track.clone()?.len())); // DEBUG

		for note in &track.clone()? { // DEBUG
			log(&format!("{:?} octave={} start={} end={}", note.note.note_value, note.note.octave, note.start_time_ms, note.end_time_ms));
		}

		self.note_track.add_track(&track?);
		Ok(())

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

fn parse_note_name(note_name: &str) -> Result<crate::utils::Note, JsValue> {
	if note_name.len() < 2 {
		return Err(JsValue::from_str("Invalid note name"));
	}

	let octave_start = note_name.find(|character: char| {
		character.is_ascii_digit() || character == '-'
	})
	.ok_or_else(|| JsValue::from_str("Note octave is missing"))?;

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
			return Err(JsValue::from_str(
				&format!("Invalid note value: {}", note_part),
			));
		}
	};

	let octave = octave_part.parse::<i32>().map_err(|_| JsValue::from_str("Invalid note octave"))?;

	Ok(crate::utils::Note {
		note_value: Some(note_value),
		octave,
	})
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}
