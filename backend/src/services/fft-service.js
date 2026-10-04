import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { AudioProcessor } = require("../../../wasm-node/audio_processor.js");

class FftService {
	constructor() {
		this.AudioProcessor = AudioProcessor;
		this.audioProcessor = null;
	}

	initialize({ notes, sampleRate, fftSize }) {
		this.audioProcessor = this.AudioProcessor.new(sampleRate, fftSize);

		this.setNotes(notes);
	}

	setNotes(notes) {
		this.audioProcessor.add_track_json(JSON.stringify(notes));
	}

	processAudio(samples) {
		if (this.audioProcessor === null) {
			console.log("No track set - call POST /api/notes before /listened-audio");
			return [];
		}

		const audioData = Uint8Array.from(samples);

		const cursorTimestamp = this.audioProcessor.cursor_location_from_mic_input(audioData);
		console.log("cursorTimestamp fft service: ", cursorTimestamp);
		if (cursorTimestamp === undefined || cursorTimestamp === null) {
			return [];
		}

		return [
			{
				timestampMs: cursorTimestamp,
				confidence: 1
			}
		];
	}
}

export const fftService = new FftService();