import init, { AudioProcessor } from "../wasm/audio_processor.js";
import { generateSineWave } from "./audio-generator.js";
import { getMedian } from "./metrics.js";

const DEFAULT_MIN_NOTE_DURATION_MS = 50;

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

			const windows = splitIntoWindows(samples, config.fftSize, config.hopSize);
			
			if (windows.length === 0)
				throw new Error(`Signal of ${samples.length} samples is shorter than fftSize ${config.fftSize}. Increase durationMs.`);

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
	// throw new Error("Audio recognition WASM adapter is not implemented yet.");

	const { samples, durationMs } = await loadAudioSamples(test.input.audioFile, config.sampleRate);

	const windows = splitIntoWindows(samples, config.fftSize, config.hopSize);
	if (windows.length === 0)
		throw new Error(`Audio file of ${samples.length} samples is shorter than fftSize ${config.fftSize}.`);

	const processor = createProcessor(config);

	try {
		const hopMs = config.hopSize / config.sampleRate * 1000;
		const windowMs = config.fftSize / config.sampleRate * 1000;

		const detectedNotes = windows.map((window, index) => {
			const detected = JSON.parse(processor.detect_pitch_details(window));
			const centerMs = index * hopMs + windowMs / 2;

			return {
				note: detected.note,
				start: index === 0 ? 0 : centerMs - hopMs / 2,
				end : index === windows.length - 1 ? durationMs : centerMs + hopMs / 2,
			};
		});

		const minDurationMs = test.input.minNoteDurationMs ?? DEFAULT_MIN_NOTE_DURATION_MS;

		const notes = mergeConsecutiveNotes(
			mergeConsecutiveNotes(detectedNotes)
			.filter(note => note.end - note.start >= minDurationMs)
		).filter(note => note.note !== null)
		.map(note => ({
			note: note.note,
			start: Math.round(note.start),
			end: Math.round(note.end),
		}));

		return {
			totalWindows: windows.length,
			notes,
		};
	} finally {
		processor.free();
	}
}

async function loadAudioSamples(url, sampleRate) {
	const response = await fetch(url);

	if (!response.ok) 
		throw new Error(`Failed to load audio file ${url}: ${response.status} ${response.statusText}`);

	const context = new OfflineAudioContext(1, 1, sampleRate); // https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext
	const buffer = await context.decodeAudioData(await response.arrayBuffer()); // https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData

	return {
		samples: toByteSamples(mixToMono(buffer)),
		durationMs: buffer.duration * 1000,
	};
}

function mixToMono(buffer) {
	const mono = new Float32Array(buffer.length);

	for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
		const data = buffer.getChannelData(channel); // https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer/getChannelData

		for (let i = 0; i < data.length; i++)
			mono[i] += data[i] / buffer.numberOfChannels;
	}

	return mono;
}

function toByteSamples(samples) {
	const bytes = new Uint8Array(samples.length);

	for (let i = 0; i < samples.length; i++) {
		const value = Math.max(-1, Math.min(1, samples[i]));
		bytes[i] = Math.round((value + 1) * 127.5);
	}

	return bytes;
}

function mergeConsecutiveNotes(notes) {
	const merged = [];

	for (const note of notes) {
		const last = merged.at(-1);

		if (last && last.note === note.value)
			last.end = note.end;
		else
			merged.push({ ...note });
	}

	return merged;
}

async function executeScoreTrackingTest(test, config) {
	throw new Error("Score tracking WASM adapter is not implemented yet.");
}

function validateSupportedConfig(config) {
	const errors = [];

	if (config.windowSize !== config.fftSize)
		errors.push("Different windowSize and fftSize are not supported yet.");

	if (config.trackThreshold !== 0.9 ||
		config.slack !== 2
	)
		errors.push("Custom DTW paramenters are not supported yet.");

	if (config.tauMax > config.fftSize / 2)
		errors.push("Invalid tauMax value.");

	if (errors.length > 0)
		throw new Error(errors.join("\n"));
}