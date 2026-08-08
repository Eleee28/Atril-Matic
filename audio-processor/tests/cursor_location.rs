//! Native (non-wasm) test for AudioProcessor's mic-input-to-cursor pipeline.
//! Run with: cargo test --test cursor_location

mod common;

use audio_processor::AudioProcessor;
use audio_processor::utils::{NoteValue, SheetNote};
use common::{note, sine_bytes, FFT_SIZE, SAMPLE_RATE};

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
    processor.add_track(vec![filler, target]);

    // The A4 run starts at the first feature slice where the filler note ends
    // at 1000ms. Each feature slice lasts FFTM_SIZE / SAMPLE_RATE seconds, so
    // the matching slice corresponds to 1024 ms (24 slices * 42.666... ms per slice).
    let expected_start = (24.0f32 * (FFT_SIZE as f32 / SAMPLE_RATE as f32) * 1000.0f32) as u32 + 1;
    debug_assert_eq!(expected_start, 1024);

    let mic_data = sine_bytes(a4_freq, 0.7, FFT_SIZE);

    // First call: free-start acquisition locks onto the start of the A4 run.
    let first = processor.cursor_location_from_mic_input(&mic_data);
    assert_eq!(first, Some(expected_start));

    // Following calls: tracking advances monotonically while the same note
    // keeps being sung, and never falls back behind the lock point.
    let second = processor.cursor_location_from_mic_input(&mic_data).unwrap();
    let third = processor.cursor_location_from_mic_input(&mic_data).unwrap();
    assert!(second > expected_start, "tracking must advance past the lock point");
    assert!(third > second, "tracking must keep advancing");
    assert!(third < 3000, "cursor must stay inside the A4 run");
}

#[test]
fn repeated_notes_advance_monotonically() {
    // 4 identical B4 notes, each 250 ms (16ths at 120 BPM): the case that used
    // to pin the cursor to the first note forever.
    let b4 = note(NoteValue::B, 4);
    let track: Vec<SheetNote> = (0..4)
        .map(|i| SheetNote {
            note: b4,
            start_time_ms: i * 250,
            end_time_ms: (i + 1) * 250,
        })
        .collect();

    let mut processor = AudioProcessor::new(SAMPLE_RATE, FFT_SIZE);
    processor.add_track(track);

    // B4 tuned to land on FFT bin 21 (21 * 48000 / 2048 = 492.1875 Hz).
    let b4_freq = 21.0 * SAMPLE_RATE / FFT_SIZE as f64;
    let mic_data = sine_bytes(b4_freq, 0.7, FFT_SIZE);

    let positions: Vec<u32> = (0..8)
        .filter_map(|_| processor.cursor_location_from_mic_input(&mic_data))
        .collect();

    assert_eq!(positions.len(), 8, "every fed slice must produce a position");
    assert!(
        positions.windows(2).all(|w| w[1] > w[0]),
        "position must advance monotonically: {:?}",
        positions
    );
    assert!(
        positions.last().unwrap() > &positions[0],
        "cursor must move, not stay pinned to the first note"
    );
}
