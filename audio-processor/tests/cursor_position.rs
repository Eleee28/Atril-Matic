//! Tests for where `AudioProcessor::cursor_location_from_mic_input` puts the
//! cursor, feeding a sequence of played notes through the mic-input path.
//! Run with: cargo test --test cursor_position

mod common;

use audio_processor::AudioProcessor;
use audio_processor::utils::{Note, NoteValue, SheetNote};
use common::{note, sine_bytes, FFT_SIZE, SAMPLE_RATE};

/// Frequency of FFT bin `bin`, so the test input lands on an exact FFT bin and
/// the pitch detector is unambiguous.
fn bin_frequency(bin: usize) -> f64 {
    bin as f64 * SAMPLE_RATE / FFT_SIZE as f64
}

fn sheet(note: Note, start_time_ms: u32, end_time_ms: u32) -> SheetNote {
    SheetNote {
        note,
        start_time_ms,
        end_time_ms,
    }
}

/// Four notes back to back, one second each. Because none of them overlap,
/// every window holds exactly one note and the expected cursor timestamp is
/// simply that window's start time.
///
/// F4 = bin 15, A4 = bin 19, C5 = bin 22, E5 = bin 28.
fn four_note_track() -> Vec<SheetNote> {
    vec![
        sheet(note(NoteValue::F, 4), 0, 1000),
        sheet(note(NoteValue::A, 4), 1000, 2000),
        sheet(note(NoteValue::C, 5), 2000, 3000),
        sheet(note(NoteValue::E, 5), 3000, 4000),
    ]
}

#[test]
fn the_cursor_lands_on_the_start_of_each_played_note() {
    let mut processor = AudioProcessor::new(SAMPLE_RATE, FFT_SIZE);
    processor.add_track(four_note_track());

    let played = [
        (15usize, 0u32),
        (19, 1000),
        (22, 2000),
        (28, 3000),
    ];

    for (bin, expected_ms) in played {
        let data = sine_bytes(bin_frequency(bin), 0.7, FFT_SIZE);
        assert_eq!(
            processor.cursor_location_from_mic_input(&data),
            Some(expected_ms),
            "playing bin {} should put the cursor at {} ms",
            bin,
            expected_ms
        );
    }
}

#[test]
fn the_cursor_stays_put_when_the_same_note_is_held() {
    // While a single window is being played the cursor must not creep forward
    // on every sample: the window is a whole second long.
    let mut processor = AudioProcessor::new(SAMPLE_RATE, FFT_SIZE);
    processor.add_track(four_note_track());

    let data = sine_bytes(bin_frequency(15), 0.7, FFT_SIZE); // F4, window 0..1000

    let first = processor.cursor_location_from_mic_input(&data);
    assert_eq!(first, Some(0), "the first sample locks onto the F4 window");

    for _ in 0..4 {
        let position = processor.cursor_location_from_mic_input(&data);
        assert_eq!(
            position, first,
            "holding one note must not advance the cursor"
        );
    }
}

#[test]
fn the_cursor_does_not_move_on_a_note_that_is_not_in_the_track() {
    // D5 (bin 25) appears nowhere in the reference track.
    let mut processor = AudioProcessor::new(SAMPLE_RATE, FFT_SIZE);
    processor.add_track(four_note_track());

    let f4 = sine_bytes(bin_frequency(15), 0.7, FFT_SIZE);
    let d5 = sine_bytes(bin_frequency(25), 0.7, FFT_SIZE);

    assert_eq!(processor.cursor_location_from_mic_input(&f4), Some(0));

    for _ in 0..3 {
        assert_eq!(
            processor.cursor_location_from_mic_input(&d5),
            None,
            "an unrelated note must be rejected rather than matched"
        );
    }
}

#[test]
fn the_cursor_does_not_move_while_the_input_is_silent() {
    let mut processor = AudioProcessor::new(SAMPLE_RATE, FFT_SIZE);
    processor.add_track(four_note_track());

    let f4 = sine_bytes(bin_frequency(15), 0.7, FFT_SIZE);
    let silence = vec![128u8; FFT_SIZE];

    assert_eq!(processor.cursor_location_from_mic_input(&f4), Some(0));

    for _ in 0..3 {
        assert_eq!(
            processor.cursor_location_from_mic_input(&silence),
            None,
            "silence must not drag the cursor anywhere"
        );
    }
}

#[test]
fn a_rest_between_notes_is_jumped_over_rather_than_matched() {
    // A 1000-2000 rest: the track only holds an A4 window starting at 2000, so
    // the cursor must report 2000 and never 1000.
    let mut processor = AudioProcessor::new(SAMPLE_RATE, FFT_SIZE);
    processor.add_track(vec![
        sheet(note(NoteValue::F, 4), 0, 1000),
        sheet(note(NoteValue::A, 4), 2000, 3000),
    ]);

    let f4 = sine_bytes(bin_frequency(15), 0.7, FFT_SIZE);
    let a4 = sine_bytes(bin_frequency(19), 0.7, FFT_SIZE);

    assert_eq!(processor.cursor_location_from_mic_input(&f4), Some(0));
    assert_eq!(
        processor.cursor_location_from_mic_input(&a4),
        Some(2000),
        "the gap must not shift the timestamp of the note after it"
    );
}

#[test]
fn the_cursor_is_clamped_to_the_end_of_the_track() {
    let mut processor = AudioProcessor::new(SAMPLE_RATE, FFT_SIZE);
    processor.add_track(four_note_track());

    // Jump straight to the last window by playing E5.
    let e5 = sine_bytes(bin_frequency(28), 0.7, FFT_SIZE);
    assert_eq!(
        processor.cursor_location_from_mic_input(&e5),
        Some(3000),
        "free-start acquisition should find the last window directly"
    );

    // Keep playing past the end of the score: the cursor must stay at the end
    // of the track rather than running off it.
    for _ in 0..3 {
        let position = processor.cursor_location_from_mic_input(&e5);
        assert!(
            position.map_or(true, |ms| ms <= 4000),
            "cursor ran past the end of the track: {:?}",
            position
        );
    }
}
