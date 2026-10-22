// To generate files run: node testing/generate-tests.js > testing/tests/test-all-notes.json

const NOTE_NAMES = [
	"C", "C#", "D", "D#", "E", "F",
	"F#", "G", "G#", "A", "A#", "B",
];

function midiToFrequency(midi) {
	return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiToNote(midi) {
	const note = NOTE_NAMES[midi % 12];
	const octave = Math.floor(midi / 12) - 1;

	return `${note}${octave}`;
}

function generateAllNotesTest() {
	const frequencies = [];
	const notes = [];

	// C0 = MIDI 12, B9 = MIDI 131 (https://inspiredacoustics.com/en/MIDI_note_numbers_and_center_frequencies)
	for (let midi = 12; midi <= 131; midi++) {
		frequencies.push(Number(midiToFrequency(midi).toFixed(6)));

		notes.push(midiToNote(midi));
	}

	return {
		id: "test-all-notes",
		name: "All Notes C0-B9",
		description: "Test all 120 notes from C0 to B9 including sharps",
		type: "pitch-detection",
		config: {
			sampleRate: 48000,
			fftSize: 65536,
			windowSize: 65536,
			hopSize: 512,
			windowFunction: "hann",

			pitchAlgorithm: "fft-peak",
			minFrequency: 15,
			maxFrequency: 20000,
			magnitudeThreshold: 10,
			maxHarmonicDivisor: 4,
			subharmonicThreshold: 0.5,

			queryCapacity: 20,
			acceptThreshold: 1.5,
			trackThreshold: 0.9,
			slack: 2,
			recoverAfter: 2,
		},
		input: {
			type: "sine",
			frequencies,
			durationMs: 1500,
		},
		expected: {
			notes,
			minAccuracy: 0.95,
		},
	};
}

console.log(JSON.stringify(generateAllNotesTest(), null, 4));