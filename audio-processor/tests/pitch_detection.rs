//! Tests for single-note recognition in `PitchDetector`.
//! Run with: cargo test --test pitch_detection

mod common;

use audio_processor::pitch_detector::PitchDetector;
use audio_processor::utils::NoteValue;
use common::{sine_bytes, sum_sine_bytes, FFT_SIZE, SAMPLE_RATE};

/// Frequency of FFT bin `bin` at the test sample rate / fft size.
///
/// Tying every input to an exact bin keeps the expectation free of rounding
/// questions: `find_fundamental` returns `max_index * bin_width`, so a pure
/// sine sitting exactly on bin `b` is reported at exactly `b * bin_width` Hz.
fn bin_frequency(bin: usize) -> f64 {
    bin as f64 * SAMPLE_RATE / FFT_SIZE as f64
}

/// (bin, expected note value, expected octave).
///
/// Only bins whose frequency sits well away from the halfway point between two
/// semitones are used, so the table stays meaningful even if the bin width
/// changes. `from_frequency` rounds to the nearest MIDI number, and
/// `from_index`/`octave` follow the usual MIDI convention (A4 = 69).
const VOCAL_RANGE: &[(usize, NoteValue, i32)] = &[
    (5, NoteValue::ASharp, 2),
    (7, NoteValue::E, 3),
    (10, NoteValue::ASharp, 3),
    (11, NoteValue::C, 4),
    (14, NoteValue::E, 4),
    (15, NoteValue::F, 4),
    (16, NoteValue::FSharp, 4),
    (19, NoteValue::A, 4),
    (21, NoteValue::B, 4),
    (22, NoteValue::C, 5),
    (25, NoteValue::D, 5),
    (28, NoteValue::E, 5),
    (33, NoteValue::G, 5),
    (40, NoteValue::ASharp, 5),
    (45, NoteValue::C, 6),
    (53, NoteValue::DSharp, 6),
    (56, NoteValue::E, 6),
    (63, NoteValue::FSharp, 6),
];

#[test]
fn detects_pure_sine_notes_across_the_vocal_range() {
    let mut detector = PitchDetector::new(SAMPLE_RATE, FFT_SIZE);

    for (bin, expected_value, expected_octave) in VOCAL_RANGE {
        let detected = detector.detect_pitch(&sine_bytes(bin_frequency(*bin), 0.7, FFT_SIZE));

        assert_eq!(
            (detected.note_value, detected.octave),
            (Some(*expected_value), *expected_octave),
            "bin {} ({:.3} Hz) should be recognised as {:?}{}",
            bin,
            bin_frequency(*bin),
            expected_value,
            expected_octave
        );
    }
}

#[test]
fn recognises_notes_played_an_octave_apart() {
    // The same pitch class two octaves apart must not be confused; this is the
    // failure mode of reporting a harmonic peak instead of the fundamental.
    let mut detector = PitchDetector::new(SAMPLE_RATE, FFT_SIZE);

    // C4 = bin 11, C5 = bin 22, C6 = bin 45.
    for bin in [11usize, 22, 45] {
        let detected = detector.detect_pitch(&sine_bytes(bin_frequency(bin), 0.7, FFT_SIZE));
        assert_eq!(
            detected.note_value,
            Some(NoteValue::C),
            "bin {} should be recognised as some C",
            bin
        );
    }

    let octaves: Vec<i32> = [11usize, 22, 45]
        .iter()
        .map(|bin| {
            detector
                .detect_pitch(&sine_bytes(bin_frequency(*bin), 0.7, FFT_SIZE))
                .octave
        })
        .collect();
    assert_eq!(
        octaves,
        vec![4, 5, 6],
        "octave must track the pitch, not collapse onto a single value"
    );
}

#[test]
fn reports_silence_for_a_flat_signal() {
    // 128 is the byte value of the zero crossing, so the whole buffer is 0.0
    // and the spectrum has no energy at all.
    let mut detector = PitchDetector::new(SAMPLE_RATE, FFT_SIZE);
    let detected = detector.detect_pitch(&vec![128u8; FFT_SIZE]);

    assert_eq!(
        detected.note_value, None,
        "a silent buffer must not be reported as a note"
    );
    assert_eq!(detected.octave, 0, "silence uses octave 0 as a sentinel");
}

#[test]
fn corrects_to_the_fundamental_when_a_harmonic_is_the_peak() {
    // The 3rd harmonic (F#6, bin 63) is the strongest peak, but the true
    // fundamental (B4, bin 21) carries enough energy to trigger the
    // sub-harmonic correction. Without it the note is reported as F#6.
    let mut detector = PitchDetector::new(SAMPLE_RATE, FFT_SIZE);
    let b4 = bin_frequency(21);

    let detected = detector.detect_pitch(&sum_sine_bytes(
        &[
            (b4, 0.45),       // fundamental (bin 21)
            (2.0 * b4, 0.35), // 2nd harmonic (bin 42)
            (3.0 * b4, 0.6),  // 3rd harmonic (bin 63), strongest peak
        ],
        FFT_SIZE,
    ));

    assert_eq!(
        (detected.note_value, detected.octave),
        (Some(NoteValue::B), 4),
        "the fundamental must win over the strongest harmonic"
    );
}

#[test]
fn corrects_to_the_fundamental_for_a_non_divisible_peak_bin() {
    // Same track, but the strongest peak is 1500 Hz (bin 64), which is not
    // divisible by 3. A naive `64 % 3 != 0` style check would skip the
    // sub-harmonic search and report F#6.
    let mut detector = PitchDetector::new(SAMPLE_RATE, FFT_SIZE);
    let b4 = bin_frequency(21);

    let detected = detector.detect_pitch(&sum_sine_bytes(
        &[
            (b4, 0.45),       // fundamental (bin 21)
            (2.0 * b4, 0.35), // 2nd harmonic (bin 42)
            (1500.0, 0.6),    // strongest peak, bin 64 (64 % 3 != 0)
        ],
        FFT_SIZE,
    ));

    assert_eq!(
        (detected.note_value, detected.octave),
        (Some(NoteValue::B), 4),
        "sub-harmonic correction must use rounding, not exact divisibility"
    );
}
