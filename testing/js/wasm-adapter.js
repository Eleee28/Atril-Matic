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
	return AudioProcessor.new_with_config(JSON.stringify(config));
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
				const detected = JSON.parse(processor.detect_pitch_details(window));

				// Keep null values to count missed detections
				detectedNotes.push({
					note: detected.note,
					frequency: detected.frequency,
					magnitude: detected.magnitude,
				});
			}

			const detectedNote = getMostFrequentNote(
				detectedNotes
					.map(result => result.note)
					.filter((note) => note !== null)
			);

			const correctWindows = detectedNotes.filter(
				(result) => result.note === expectedNote
			).length;

			const accuracy = detectedNotes.length > 0 ? correctWindows / detectedNotes.length : 0;

			const detectedFrequency = getMedian(
				detectedNotes
					.filter(result =>
						result.note === detectedNote &&
						Number.isFinite(result.frequency)
					)
					.map(result => result.frequency)
			);

			const frequencyError = calculateFrequencyError(frequency, detectedFrequency);

			// console.log({
			// 	frequency,
			// 	expectedNote,
			// 	detectedNotes,
			// 	detectedNote,
			//	detectedFrequency,
			//	...frequencyError,
			// 	correctWindows,
			// 	totalWindows: windows.length,
			// 	accuracy,
			// });

			results.push({
				frequency,
				expected: expectedNote,

				actual: detectedNote,
				detectedFrequency,

				...frequencyError,

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

function getMedian(values) {
	if (values.length === 0)
		return null;

	const sorted = [...values].sort((a, b) => a - b);

	const middle = Math.floor(sorted.length / 2);

	if (sorted.length % 2 === 0)
		return (sorted[middle - 1] + sorted[middle] / 2);

	return sorted[middle];
}

// Calculates the error between two frequencies:
//	- Absolute error: Error (Hz) = | f_detected - f_expected |
//	- Error in cents: Error (cents) = 1200 log_2(f_detected / f_expected)
// Cents is useful in music because it measures the difference independently of the octave
// https://chiooone.com/en/knowledge/cents-and-pitch-training/
function calculateFrequencyError(expected, detected) {
	if (detected === null || detected <= 0)
		return {
			errorHz: null,
			errorCents: null,
		};

	return {
		errorHz: Math.abs(detected - expected),
		errorCents: 1200 * Math.log2(detected / expected),
	};
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

	if (config.trackThreshold !== 0.9 ||
		config.slack !== 2
	)
		errors.push("Custom DTW paramenters are not supported yet.");

	if (errors.length > 0)
		throw new Error(errors.join("\n"));
}