import init, { AudioProcessor } from "../wasm/audio_processor.js";
import { generateSineWave } from "./audio-generator.js";

let wasmInitialized = false;

async function initializeWasm() {
	if (wasmInitialized)
		return;

	await init();
	wasmInitialized = true;
}

function createProcessor(config) {
	return new AudioProcessor(config.sampleRate, config.fftSize);
}

function splitIntoWindows(samples, windowSize, hopSize) {
	const windows = [];

	for (
		let offset = 0;
		offset + windowSize <= samples.length;
		offset += hopSize
	) {
		windows.push(samples.slice(offset, offset + windowSize));
	}

	return windows;
}

export async function executeTest(test, config) {
	validateSupportedConfig(config);
	
	await initializeWasm();

	switch (test.type) {
		case "pitch-detection":
			return executePitchDetectionTest(test, config);

		case "audio-recognition":
			return executeAudioRecognitionTest(test, config);

		case "score-tracking":
			return executeScoreTrackingTest(test, config);

		default:
			throw new Error(`Unsupported test type: ${test.type}`);
	}
}

async function executePitchDetectionTest(test, config) {
	


	const processor = createProcessor(config);

	try {
		const results = [];

		for (let i = 0; i < test.input.frequencies.length; i++) {
			const frequency = test.input.frequencies[i];
			const expectedNote = test.expected.notes[i];

			const samples = generateSineWave({
				frequency,
				sampleRate: config.sampleRate,
				durationMs: test.input.durationMs,
			});

			const windows = splitIntoWindows(
				samples, 
				config.fftSize, 
				config.hopSize
			);

			const detectedNotes = [];

			for (const window of windows) {

				const note = processor.detect_pitch_name(window);

				// Keep null values to count missed detections
				detectedNotes.push(note);
			}

			const detectedNote = getMostFrequentNote(
				detectedNotes.filter((note) => note !== null)
			);

			const correctWindows = detectedNotes.filter(
				(note) => note === test.expected.note
			).length;

			const accuracy = windows.length > 0 ? correctWindows / windows.length : 0;

			results.push({
				frequency,
				expected: expectedNote,
				actual: detectedNote,
				passed: detectedNote === expectedNote,
				accuracy,
				totalWindows: windows.length,
				correctWindows,
				detectedNotes,
			});
		}

		

		return {
			total: results.length,
			passed: results.filter(r => r.passed).length,
			failed: results.filter(r => !r.passed).length,
			results,
		};
	} finally {
		processor.free();
	}
}

function getMostFrequentNote(notes) {
	if (notes.length === 0)
		return null;

	const counts = new Map();

	for (const note of notes) {
		counts.set(note, (counts.get(note) ?? 0) + 1);
	}

	return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

async function executeAudioRecognitionTest(test, config) {
	throw new Error("Audio recognition WASM adapter is not implemented yet.");
}

async function executeScoreTrackingTest(test, config) {
	throw new Error("Score tracking WASM adapter is not implemented yet.");
}

function validateSupportedConfig(config) {
	const errors = [];

	if (config.windowSize !== config.fftSize)
		errors.push("Different windowSize and fftSize are not supported yet.");

	if (config.windowFunction !== "hann")
		errors.push("Only Hann window is currently supported.");

	if (config.pitchAlgorithm !== "fft-peak")
		errors.push("Only FFT Peak is currently supported.");

	if (config.minFrequency !== 60 || config.maxFrequency !== 2000)
		errors.push("Custom frequency ranges are not supported.");

	if (config.magnitudeThreshold !== 10 ||
		config.maxHarmonicDivisor !== 4 ||
		config.subharmonicThreshold !== 0.5
	)
		errors.push("Custom pitch detection thresholds are not supported yet.")

	if (config.queryCapacity !== 50 ||
		config.acceptThreshold !== 1.5 ||
		config.trackThreshold !== 0.9 ||
		config.slack !== 2 ||
		config.recoverAfter !== 5
	)
		errors.push("Custom DTW paramenters are not supported yet.");

	if (errors.length > 0)
		throw new Error(errors.join("\n"));
}