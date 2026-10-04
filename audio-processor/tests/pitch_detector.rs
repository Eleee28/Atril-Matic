mod common;

use audio_processor::pitch_detector::PitchDetector;
use audio_processor::utils::NoteValue;
use common::{sine_bytes, FFT_SIZE, SAMPLE_RATE};

const NOTES: [(&str, f64, i32, NoteValue); 120] = [
	// Octave 0
	("C0", 16.3516, 0, NoteValue::C),
	("C#0", 17.3239, 0, NoteValue::CSharp),
	("D0", 18.3540, 0, NoteValue::D),
	("D#0", 19.4454, 0, NoteValue::DSharp),
	("E0", 20.6017, 0, NoteValue::E),
	("F0", 21.8268, 0, NoteValue::F),
	("F#0", 23.1247, 0, NoteValue::FSharp),
	("G0", 24.4997, 0, NoteValue::G),
	("G#0", 25.9565, 0, NoteValue::GSharp),
	("A0", 27.5000, 0, NoteValue::A),
	("A#0", 29.1352, 0, NoteValue::ASharp),
	("B0", 30.8677, 0, NoteValue::B),

	// Octave 1
	("C1", 32.7032, 1, NoteValue::C),
	("C#1", 34.6478, 1, NoteValue::CSharp),
	("D1", 36.7081, 1, NoteValue::D),
	("D#1", 38.8909, 1, NoteValue::DSharp),
	("E1", 41.2034, 1, NoteValue::E),
	("F1", 43.6535, 1, NoteValue::F),
	("F#1", 46.2493, 1, NoteValue::FSharp),
	("G1", 48.9994, 1, NoteValue::G),
	("G#1", 51.9131, 1, NoteValue::GSharp),
	("A1", 55.0000, 1, NoteValue::A),
	("A#1", 58.2705, 1, NoteValue::ASharp),
	("B1", 61.7354, 1, NoteValue::B),

	// Octave 2
	("C2", 65.4064, 2, NoteValue::C),
	("C#2", 69.2957, 2, NoteValue::CSharp),
	("D2", 73.4162, 2, NoteValue::D),
	("D#2", 77.7817, 2, NoteValue::DSharp),
	("E2", 82.4069, 2, NoteValue::E),
	("F2", 87.3071, 2, NoteValue::F),
	("F#2", 92.4986, 2, NoteValue::FSharp),
	("G2", 97.9989, 2, NoteValue::G),
	("G#2", 103.8262, 2, NoteValue::GSharp),
	("A2", 110.0000, 2, NoteValue::A),
	("A#2", 116.5409, 2, NoteValue::ASharp),
	("B2", 123.4708, 2, NoteValue::B),

	// Octave 3
	("C3", 130.8128, 3, NoteValue::C),
	("C#3", 138.5913, 3, NoteValue::CSharp),
	("D3", 146.8324, 3, NoteValue::D),
	("D#3", 155.5635, 3, NoteValue::DSharp),
	("E3", 164.8138, 3, NoteValue::E),
	("F3", 174.6141, 3, NoteValue::F),
	("F#3", 184.9972, 3, NoteValue::FSharp),
	("G3", 195.9977, 3, NoteValue::G),
	("G#3", 207.6523, 3, NoteValue::GSharp),
	("A3", 220.0000, 3, NoteValue::A),
	("A#3", 233.0819, 3, NoteValue::ASharp),
	("B3", 246.9417, 3, NoteValue::B),

	// Octave 4
	("C4", 261.6256, 4, NoteValue::C),
	("C#4", 277.1826, 4, NoteValue::CSharp),
	("D4", 293.6648, 4, NoteValue::D),
	("D#4", 311.1270, 4, NoteValue::DSharp),
	("E4", 329.6276, 4, NoteValue::E),
	("F4", 349.2282, 4, NoteValue::F),
	("F#4", 369.9944, 4, NoteValue::FSharp),
	("G4", 391.9954, 4, NoteValue::G),
	("G#4", 415.3047, 4, NoteValue::GSharp),
	("A4", 440.0000, 4, NoteValue::A),
	("A#4", 466.1638, 4, NoteValue::ASharp),
	("B4", 493.8833, 4, NoteValue::B),

	// Octave 5
	("C5", 523.2511, 5, NoteValue::C),
	("C#5", 554.3653, 5, NoteValue::CSharp),
	("D5", 587.3295, 5, NoteValue::D),
	("D#5", 622.2540, 5, NoteValue::DSharp),
	("E5", 659.2551, 5, NoteValue::E),
	("F5", 698.4565, 5, NoteValue::F),
	("F#5", 739.9888, 5, NoteValue::FSharp),
	("G5", 783.9909, 5, NoteValue::G),
	("G#5", 830.6094, 5, NoteValue::GSharp),
	("A5", 880.0000, 5, NoteValue::A),
	("A#5", 932.3275, 5, NoteValue::ASharp),
	("B5", 987.7666, 5, NoteValue::B),

	// Octave 6
	("C6", 1046.5023, 6, NoteValue::C),
	("C#6", 1108.7305, 6, NoteValue::CSharp),
	("D6", 1174.6591, 6, NoteValue::D),
	("D#6", 1244.5079, 6, NoteValue::DSharp),
	("E6", 1318.5102, 6, NoteValue::E),
	("F6", 1396.9129, 6, NoteValue::F),
	("F#6", 1479.9777, 6, NoteValue::FSharp),
	("G6", 1567.9817, 6, NoteValue::G),
	("G#6", 1661.2188, 6, NoteValue::GSharp),
	("A6", 1760.0000, 6, NoteValue::A),
	("A#6", 1864.6550, 6, NoteValue::ASharp),
	("B6", 1975.5332, 6, NoteValue::B),

	// Octave 7
	("C7", 2093.0045, 7, NoteValue::C),
	("C#7", 2217.4610, 7, NoteValue::CSharp),
	("D7", 2349.3181, 7, NoteValue::D),
	("D#7", 2489.0159, 7, NoteValue::DSharp),
	("E7", 2637.0205, 7, NoteValue::E),
	("F7", 2793.8259, 7, NoteValue::F),
	("F#7", 2959.9554, 7, NoteValue::FSharp),
	("G7", 3135.9635, 7, NoteValue::G),
	("G#7", 3322.4376, 7, NoteValue::GSharp),
	("A7", 3520.0000, 7, NoteValue::A),
	("A#7", 3729.3101, 7, NoteValue::ASharp),
	("B7", 3951.0664, 7, NoteValue::B),

	// Octave 8
	("C8", 4186.0090, 8, NoteValue::C),
	("C#8", 4434.9221, 8, NoteValue::CSharp),
	("D8", 4698.6363, 8, NoteValue::D),
	("D#8", 4978.0317, 8, NoteValue::DSharp),
	("E8", 5274.0409, 8, NoteValue::E),
	("F8", 5587.6517, 8, NoteValue::F),
	("F#8", 5919.9108, 8, NoteValue::FSharp),
	("G8", 6271.9270, 8, NoteValue::G),
	("G#8", 6644.8752, 8, NoteValue::GSharp),
	("A8", 7040.0000, 8, NoteValue::A),
	("A#8", 7458.6202, 8, NoteValue::ASharp),
	("B8", 7902.1328, 8, NoteValue::B),

	// Octave 9
	("C9", 8372.0181, 9, NoteValue::C),
	("C#9", 8869.8442, 9, NoteValue::CSharp),
	("D9", 9397.2726, 9, NoteValue::D),
	("D#9", 9956.0635, 9, NoteValue::DSharp),
	("E9", 10548.0818, 9, NoteValue::E),
	("F9", 11175.3034, 9, NoteValue::F),
	("F#9", 11839.8215, 9, NoteValue::FSharp),
	("G9", 12543.8540, 9, NoteValue::G),
	("G#9", 13289.7503, 9, NoteValue::GSharp),
	("A9", 14080.0000, 9, NoteValue::A),
	("A#9", 14917.2404, 9, NoteValue::ASharp),
	("B9", 15804.2656, 9, NoteValue::B),
];

#[test]
fn detects_a4() {
	let mut detector = PitchDetector::new(SAMPLE_RATE, FFT_SIZE);

	let audio = sine_bytes(440.0, 0.7, FFT_SIZE);

	let note = detector.detect_pitch(&audio);

	assert_eq!(note.note_value, Some(NoteValue::A));
	assert_eq!(note.octave, 4);
}

#[test]
fn detects_multiple_notes() {
	let cases = [
		(261.63, NoteValue::C, 4),
		(293.66, NoteValue::D, 4),
		(329.63, NoteValue::E, 4),
		(349.23, NoteValue::F, 4),
		(392.00, NoteValue::A, 4),
		(493.88, NoteValue::B, 4),
	];

	for (frequency, expected_note, expected_octave) in cases {
		let mut detector = PitchDetector::new(SAMPLE_RATE, FFT_SIZE);

		let audio = sine_bytes(frequency, 0.7, FFT_SIZE);

		let note = detector.detect_pitch(&audio);

		assert_eq!(note.note_value, Some(expected_note), "wrong note for {frequency} Hz");
		assert_eq!(note.octave, expected_octave, "wrong octave for {frequency} Hz");
	}
}

// fn expected_note(name: &str) -> (NoteValue, i32) {
// 	let octave_start = name
// 		.find(|c: char| c.is_ascii_digit())
// 		.expect("invalid note name");

// 	let (note_name, octave_str) = name.split_at(octave_start);

// 	let note_value = match note_name {
// 		"C" => NoteValue::C,
// 		"C#" => NoteValue::CSharp,
// 		"D" => NoteValue::D,
// 		"D#" => NoteValue::DSharp,
// 		"E" => NoteValue::E,
// 		"F" => NoteValue::F,
// 		"F#" => NoteValue::FSharp,
// 		"G" => NoteValue::G,
// 		"G#" => NoteValue::GSharp,
// 		"A" => NoteValue::A,
// 		"A#" => NoteValue::ASharp,
// 		"B" => NoteValue::B,
// 		_  => panic!("invalid note name {name}"),
// 	};

// 	let octave = octave_str.parse::<i32>().unwrap();

// 	(note_value, octave)
// }

#[test]
fn detects_all_notes() {
	let mut failures = Vec::new();

	for &(name, frequency, expected_octave, expected_value) in NOTES.iter() {
		let mut detector = PitchDetector::new(SAMPLE_RATE, FFT_SIZE);

		let audio = sine_bytes(frequency, 0.7, FFT_SIZE);

		let detected = detector.detect_pitch(&audio);
		// let (expected_value, expected_octave) = expected_note(name);

		let correct = detected.note_value == Some(expected_value) && detected.octave == expected_octave;

		if !correct {
			let detected_name = match detected.note_value {
				Some(value) => format!("{}{}", value.name(), detected.octave),
				None => "None".to_string(),
			};

			failures.push(format!("{name:4} {frequency:10.4} Hz -> detected {detected_name}"));
		}
	}

	if !failures.is_empty() {
		panic!(
			"\n{} notes were detected incorrectly:\n\n{}",
			failures.len(),
			failures.join("\n")
		);
	}

	// for (name, frequency, expected_octave, expected_note) in NOTES {
	// 	let mut detector = PitchDetector::new(SAMPLE_RATE, FFT_SIZE);

	// 	let audio = sine_bytes(frequency, 0.7, FFT_SIZE);

	// 	let note = detector.detect_pitch(&audio);

	// 	assert_eq!(note.note_value, Some(expected_note), "wrong note for {frequency} Hz ({name})");
	// 	assert_eq!(note.octave, expected_octave, "wrong octave for {frequency} Hz ({name}");
	// }
}