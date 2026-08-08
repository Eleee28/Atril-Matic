use audio_processor::utils::{Note, NoteValue};

pub const SAMPLE_RATE: f64 = 48_000.0;
pub const FFT_SIZE: usize = 2048;

pub fn sine_bytes(freq: f64, amplitude: f64, n: usize) -> Vec<u8> {
    (0..n)
        .map(|i| {
            let s = (2.0 * std::f64::consts::PI * freq * i as f64 / SAMPLE_RATE).sin() * amplitude;
            ((s + 1.0) * 127.5).round() as u8
        })
        .collect()
}

pub fn note(value: NoteValue, octave: i32) -> Note {
    Note {
        note_value: Some(value),
        octave,
    }
}