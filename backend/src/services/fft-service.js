class FftService {
	constructor(audioProcessor) {
		this.audioProcessor = audioProcessor;
	}

	setNotes(notes) {
	}

	processAudio(samples) {
		const audioData = Uint8Array.from(samples);

		const cursorTimestamp = this.audioProcessor.cursor_location_from_mic_input(audioData);
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