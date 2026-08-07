//! Native (non-wasm) test for AudioProcessor's mic-input-to-cursor pipeline.
//! Run with: cargo test --test cursor_location

use audio_processor::utils::{Note, NoteValue, SheetNote};
use audio_processor::AudioProcessor;

const SAMPLE_RATE: f64 = 48_000.0;
const FFT_SIZE: usize = 2048;

fn sine_bytes(freq: f64, amplitude: f64, n: usize) -> Vec<u8> {
    (0..n)
        .map(|i| {
            let s = (2.0 * std::f64::consts::PI * freq * i as f64 / SAMPLE_RATE).sin() * amplitude;
            ((s + 1.0) * 127.5).round() as u8
        })
        .collect()
}

fn note(value: NoteValue, octave: i32) -> Note {
    Note {
        note_value: Some(value),
        octave,
    }
}

#[test]
fn cursor_location_matches_played_note_position() {
    // A4 tuned to land exactly on an FFT bin (bin 19 @ 48kHz / 2048 samples),
    // so the pitch detector reports A4 unambiguously.
    let a4_freq = 19.0 * SAMPLE_RATE / FFT_SIZE as f64; // 445.3125 Hz

    let filler = SheetNote {
        note: note(NoteValue::F, 4),
        start_time_ms: 0,
        end_time_ms: 1000,
    };
    let target = SheetNote {
        note: note(NoteValue::A, 4),
        start_time_ms: 1000,
        end_time_ms: 3000,
    };

    let mut processor = AudioProcessor::new(SAMPLE_RATE, FFT_SIZE);
    processor.add_track_json(vec![filler, target]);

    // The A4 run starts at the first feature slice where the filler note
    // no longer overlaps: 1000ms / TIME_SEGMENT_DURATION_MS + 1. Computed with
    // f32 (as the NoteTrack does) to match the slicing exactly.
    let expected_start = (1000.0f32 / (2048.0f32 / 48000.0f32)) as u32 + 1;
    debug_assert_eq!(expected_start, 23438);

    let mic_data = sine_bytes(a4_freq, 0.7, FFT_SIZE);

    // Every call points at the start of the A4 run: the free-start DTW lets the
    // whole rolling query collapse onto the first slice that matches.
    assert_eq!(
        processor.cursor_location_from_mic_input(&mic_data),
        Some(expected_start)
    );
    assert_eq!(
        processor.cursor_location_from_mic_input(&mic_data),
        Some(expected_start)
    );
    assert_eq!(
        processor.cursor_location_from_mic_input(&mic_data),
        Some(expected_start)
    );
}
