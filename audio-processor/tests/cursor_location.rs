//! Native (non-wasm) test for AudioProcessor's mic-input-to-cursor pipeline.
//! Run with: cargo test --test cursor_location

mod common;

use audio_processor::AudioProcessor;
use audio_processor::utils::{NoteValue, SheetNote};
use common::{note, sine_bytes, sum_sine_bytes, FFT_SIZE, SAMPLE_RATE};

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

#[test]
fn harmonic_rich_note_advances_monotonically() {
    // Same repeated-B4 track, but the mic signal now carries the 2nd and 3rd
    // harmonics with the 3rd harmonic (F#6, 1476 Hz) as the strongest spectral
    // peak. Before the sub-harmonic correction this was detected as F#6
    // (DTW cost 5.475) instead of B4, freezing the cursor forever.
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

    let b4_freq = 21.0 * SAMPLE_RATE / FFT_SIZE as f64; // 492.1875 Hz
    let mic_data = sum_sine_bytes(
        &[
            (b4_freq, 0.45),       // fundamental
            (2.0 * b4_freq, 0.35), // 2nd harmonic (B5)
            (3.0 * b4_freq, 0.6),  // 3rd harmonic (F#6), strongest peak
        ],
        FFT_SIZE,
    );

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

#[test]
fn non_bin_aligned_harmonic_advances_monotonically() {
    // Same repeated-B4 track, but the strongest spectral peak is a 1500 Hz tone
    // that lands exactly on bin 64 (1500 / 23.4375), which is NOT divisible by
    // 3. Before nearest-bin rounding the sub-harmonic correction skipped it
    // (`64 % 3 != 0`) and the note was still reported as F#6.
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

    let b4_freq = 21.0 * SAMPLE_RATE / FFT_SIZE as f64; // 492.1875 Hz
    let mic_data = sum_sine_bytes(
        &[
            (b4_freq, 0.45),       // fundamental (bin 21)
            (2.0 * b4_freq, 0.35), // 2nd harmonic (bin 42)
            (1500.0, 0.6),         // strongest peak, bin 64 (64 % 3 != 0)
        ],
        FFT_SIZE,
    );

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
