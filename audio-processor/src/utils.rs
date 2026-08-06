use wasm_bindgen::prelude::*;
pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function at least once during initialization, and then
    // we will get better error messages if our code ever panics.
    //
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[wasm_bindgen]
pub enum NoteValue {
    C,
    CSharp,
    D,
    DSharp,
    E,
    F,
    FSharp,
    G,
    GSharp,
    A,
    ASharp,
    B,
}

impl NoteValue {
    pub fn name(&self) -> &'static str {
        match self {
            NoteValue::C => "C",
            NoteValue::CSharp => "C#",
            NoteValue::D => "D",
            NoteValue::DSharp => "D#",
            NoteValue::E => "E",
            NoteValue::F => "F",
            NoteValue::FSharp => "F#",
            NoteValue::G => "G",
            NoteValue::GSharp => "G#",
            NoteValue::A => "A",
            NoteValue::ASharp => "A#",
            NoteValue::B => "B",
        }
    }

    pub fn base_frequency(&self) -> f64 {
        match self {
            NoteValue::C => 16.35,
            NoteValue::CSharp => 17.32,
            NoteValue::D => 18.35,
            NoteValue::DSharp => 19.45,
            NoteValue::E => 20.60,
            NoteValue::F => 21.83,
            NoteValue::FSharp => 23.12,
            NoteValue::G => 24.50,
            NoteValue::GSharp => 25.96,
            NoteValue::A => 27.50,
            NoteValue::ASharp => 29.14,
            NoteValue::B => 30.87,
        }
    }

    pub fn from_index(index: i32) -> NoteValue {
        match ((index % 12) + 12) % 12 {
            0 => NoteValue::C,
            1 => NoteValue::CSharp,
            2 => NoteValue::D,
            3 => NoteValue::DSharp,
            4 => NoteValue::E,
            5 => NoteValue::F,
            6 => NoteValue::FSharp,
            7 => NoteValue::G,
            8 => NoteValue::GSharp,
            9 => NoteValue::A,
            10 => NoteValue::ASharp,
            _ => NoteValue::B,
        }
    }

    pub fn from_frequency(frequency: f64) -> (NoteValue, i32) {
        let midi_note = 12.0 * (frequency / 440.0).log2() + 69.0;
        let midi_rounded = midi_note.round() as i32;
        let octave = (midi_rounded / 12) - 1;
        (NoteValue::from_index(midi_rounded), octave)
    }
}
#[derive(Clone, Copy)]
#[wasm_bindgen]
pub struct Note {
    pub note_value: Option<NoteValue>,
    pub octave: i32,
}
#[derive(Clone, Copy)]
#[wasm_bindgen]
pub struct SheetNote {
    pub note: Note,
    pub start_time_ms: u32,
    pub end_time_ms: u32,
}
pub(crate) fn note_to_midi(n: &Note) -> Option<i32> {
    n.note_value.map(|v| 12 * (n.octave + 1) + v as i32)
}

pub(crate) fn dtw_cost(q: &[Note], r: &[Note]) -> f64 {
    match (q.first(), r.first()) {
        (Some(a), Some(b)) => match (note_to_midi(a), note_to_midi(b)) {
            (Some(qm), Some(rm)) => {
                let qpc = qm.rem_euclid(12);
                let rpc = rm.rem_euclid(12);
                let pc_diff = (qpc - rpc).abs().min(12 - (qpc - rpc).abs()) as f64; // 0..6
                pc_diff + 0.3 * (qm - rm).abs() as f64 / 12.0
            }
            _ => 1.0, // None-valued note counts as silence
        },
        (Some(_), None) | (None, Some(_)) => 1.0, // one silent, one sounding
        (None, None) => 0.0,                      // both silent
    }
    // chords (future): pairwise min-match over the sets, same per-note formula
}
