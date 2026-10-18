export function generateSineWave({frequency, sampleRate, durationMs, amplitude = 0.8}) {
	const sampleCount = Math.round(sampleRate * durationMs / 1000);

	const samples = new Uint8Array(sampleCount);

	for (let i = 0; i < sampleCount; i++) {
		const time = i / sampleRate;

		const value = amplitude * Math.sin(2 * Math.PI * frequency * time);

		samples[i] = Math.round((value + 1) * 127.5);
	}

	return samples;
}

