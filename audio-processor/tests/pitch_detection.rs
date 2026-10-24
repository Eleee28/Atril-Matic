//! Tests for single-note recognition in `PitchDetector`.
//! Run with: cargo test --test pitch_detection

mod common;

use audio_processor::pitch_detector::PitchDetector;
use audio_processor::utils::NoteValue;
use audio_processor::config::{AudioConfig, PitchAlgorithm};

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
/// The bins are the ones whose centre frequency lands on the named note for
/// the current `FFT_SIZE = 32768` (bin width 48000/32768 = 1.46484375 Hz).
/// Each bin centre is kept well away from the halfway point between two
/// semitones, so the expectation is free of rounding questions.
/// `from_frequency` rounds to the nearest MIDI number, and
/// `from_index`/`octave` follow the usual MIDI convention (A4 = 69).
const VOCAL_RANGE: &[(usize, NoteValue, i32)] = &[
    (80, NoteValue::ASharp, 2),
    (113, NoteValue::E, 3),
    (159, NoteValue::ASharp, 3),
    (179, NoteValue::C, 4),
    (225, NoteValue::E, 4),
    (238, NoteValue::F, 4),
    (253, NoteValue::FSharp, 4),
    (300, NoteValue::A, 4),
    (337, NoteValue::B, 4),
    (357, NoteValue::C, 5),
    (401, NoteValue::D, 5),
    (450, NoteValue::E, 5),
    (535, NoteValue::G, 5),
    (636, NoteValue::ASharp, 5),
    (714, NoteValue::C, 6),
    (850, NoteValue::DSharp, 6),
    (900, NoteValue::E, 6),
    (1010, NoteValue::FSharp, 6),
];

#[test]
fn detects_pure_sine_notes_across_the_vocal_range() {
	let config = AudioConfig {
		sample_rate: SAMPLE_RATE,
		fft_size: FFT_SIZE,
		window_size: FFT_SIZE,
		..AudioConfig::default()
	};

    let mut detector = PitchDetector::new(config.clone());

    for (bin, expected_value, expected_octave) in VOCAL_RANGE {
        let detected = detector.detect_pitch(&sine_bytes(bin_frequency(*bin), 0.7, config.fft_size));

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
	let config = AudioConfig {
		sample_rate: SAMPLE_RATE,
		fft_size: FFT_SIZE,
		window_size: FFT_SIZE,
		..AudioConfig::default()
	};

    // The same pitch class two octaves apart must not be confused; this is the
    // failure mode of reporting a harmonic peak instead of the fundamental.
    let mut detector = PitchDetector::new(config.clone());

    // C4 = bin 179, C5 = bin 357, C6 = bin 714.
    for bin in [179usize, 357, 714] {
        let detected = detector.detect_pitch(&sine_bytes(bin_frequency(bin), 0.7, config.fft_size));
        assert_eq!(
            detected.note_value,
            Some(NoteValue::C),
            "bin {} should be recognised as some C",
            bin
        );
    }

    let octaves: Vec<i32> = [179usize, 357, 714]
        .iter()
        .map(|bin| {
            detector
                .detect_pitch(&sine_bytes(bin_frequency(*bin), 0.7, config.fft_size))
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
	let config = AudioConfig {
		sample_rate: SAMPLE_RATE,
		fft_size: FFT_SIZE,
		window_size: FFT_SIZE,
		..AudioConfig::default()
	};

    // 128 is the byte value of the zero crossing, so the whole buffer is 0.0
    // and the spectrum has no energy at all.
    let mut detector = PitchDetector::new(config.clone());
    let detected = detector.detect_pitch(&vec![128u8; config.fft_size]);

    assert_eq!(
        detected.note_value, None,
        "a silent buffer must not be reported as a note"
    );
    assert_eq!(detected.octave, 0, "silence uses octave 0 as a sentinel");
}

#[test]
fn corrects_to_the_fundamental_when_a_harmonic_is_the_peak() {
	let config = AudioConfig {
		sample_rate: SAMPLE_RATE,
		fft_size: FFT_SIZE,
		window_size: FFT_SIZE,
		pitch_algorithm: PitchAlgorithm::FftPeakWithHarmonics {
			magnitude_threshold: 10.0,
			max_harmonic_divisor: 4,
			subharmonic_threshold: 0.5,
		},
		..AudioConfig::default()
	};

    // The 3rd harmonic (F#6, bin 1011) is the strongest peak, but the true
    // fundamental (B4, bin 337) carries enough energy to trigger the
    // sub-harmonic correction. Without it the note is reported as F#6.
    let mut detector = PitchDetector::new(config.clone());
    let b4 = bin_frequency(337);

    let detected = detector.detect_pitch(&sum_sine_bytes(
        &[
            (b4, 0.45),         // fundamental (bin 337)
            (2.0 * b4, 0.35),   // 2nd harmonic (bin 674)
            (3.0 * b4, 0.6),    // 3rd harmonic (bin 1011), strongest peak
        ],
        config.fft_size,
    ));

    assert_eq!(
        (detected.note_value, detected.octave),
        (Some(NoteValue::B), 4),
        "the fundamental must win over the strongest harmonic"
    );
}

#[test]
fn corrects_to_the_fundamental_for_a_non_divisible_peak_bin() {
	let config = AudioConfig {
		sample_rate: SAMPLE_RATE,
		fft_size: FFT_SIZE,
		window_size: FFT_SIZE,
		pitch_algorithm: PitchAlgorithm::FftPeakWithHarmonics {
			magnitude_threshold: 10.0,
			max_harmonic_divisor: 4,
			subharmonic_threshold: 0.5,
		},
		..AudioConfig::default()
	};

    // Same track, but the strongest peak is bin_frequency(1010), which is not
    // divisible by 3 (1010 % 3 != 0) yet still rounds to the fundamental's bin
    // (337). A naive `1010 % 3 != 0` style check would skip the sub-harmonic
    // search and report F#6.
    let mut detector = PitchDetector::new(config.clone());
    let b4 = bin_frequency(337);

    let detected = detector.detect_pitch(&sum_sine_bytes(
        &[
            (b4, 0.45),         // fundamental (bin 337)
            (2.0 * b4, 0.35),   // 2nd harmonic (bin 674)
            (bin_frequency(1010), 0.6), // strongest peak, bin 1010
        ],
        config.fft_size,
    ));

    assert_eq!(
        (detected.note_value, detected.octave),
        (Some(NoteValue::B), 4),
        "sub-harmonic correction must use rounding, not exact divisibility"
    );
}
