//! Native (non-wasm) test for AudioProcessor's json to SheetNote conversion.
//! Run with: cargo test --test add_track_json

use audio_processor::AudioProcessor;

const SAMPLE_RATE: f64 = 48_000.0;
const FFT_SIZE: usize = 2048;

#[test]
fn add_track_json_accepts_valid_notes() {
    let mut processor = AudioProcessor::new(SAMPLE_RATE, FFT_SIZE);

    let json = r#"
        [
            { "note": "F4", "start": 0, "end": 1000 },
            { "note": "A4", "start": 1000, "end": 3000 }
        ]
    "#;

    assert!(processor.add_track_json(json).is_ok());
}

#[test]
fn add_track_json_rejects_invalid_notes() {
    let mut processor = AudioProcessor::new(SAMPLE_RATE, FFT_SIZE);

    let json = r#"
        [
            { "note": "F4", "start": 0, "end": 1000
        ]
    "#;

    assert!(processor.add_track_json(json).is_err());
}

#[test]
fn add_track_json_rejects_invalid_note_name() {
    let mut processor = AudioProcessor::new(SAMPLE_RATE, FFT_SIZE);

    let json = r#"
        [
            { "note": "H4", "start": 0, "end": 1000 }
        ]
    "#;

    assert!(processor.add_track_json(json).is_err());

    let json = r#"
        [
            { "note": "Ag4", "start": 0, "end": 1000 }
        ]
    "#;

    assert!(processor.add_track_json(json).is_err());

    let json = r#"
        [
            { "note": "A###4", "start": 0, "end": 1000 }
        ]
    "#;

    assert!(processor.add_track_json(json).is_err());
}

#[test]
fn cursor_location_works_with_json_track() {
    let a4_freq = 19.0 * SAMPLE_RATE / FFT_SIZE as f64;

    let json = r#"
        [
            { "note": "F4", "start": 0, "end": 1000 },
            { "note": "A4", "start": 1000, "end": 3000 }
        ]
    "#;

    let mut processor = AudioProcessor::new(SAMPLE_RATE, FFT_SIZE);
    processor.add_track_json(json).unwrap();

    let expected_start = (1000.0f32 / ((FFT_SIZE)f32 / (SAMPLE_RATE)f32)) as u32 + 1;

    let mic_data = sine_bytes(a4_freq, 0.7, FFT_SIZE);    

    assert_eq!(processor.cursor_location_from_mic_input(&mic_data), Some(expected_start));
}