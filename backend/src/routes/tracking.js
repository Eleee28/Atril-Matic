import { Router } from "express";
import { fftService } from "../services/fft-service.js";

export const trackingRouter = Router();

trackingRouter.post("/notes", (req, res) => {
	const { notes, sampleRate, fftSize } = req.body;

	const validationError = validateNotes(notes);
	if (validationError)
		return res.status(400).json({ error: validationError });

	if (typeof sampleRate !== "number" || !Number.isFinite(sampleRate) || sampleRate <= 0)
		return res.status(400).json({ error: "sampleRate must be a positive number" });

	if (typeof fftSize !== "number" || !Number.isInteger(fftSize) || fftSize <= 0)
		return res.status(400).json({ error: "sampleRate must be a positive integer" });

	fftService.initialize({
		notes,
		sampleRate,
		fftSize
	});

	return res.status(200).json({ message: "FFT initialized" });
});

trackingRouter.post("/listened-audio", (req, res) => {
	const { samples } = req.body;

	if (!Array.isArray(samples))
		return res.status(400).json({ error: "samples must be an array" });

	if (samples.some(sample => !Number.isInteger(sample) || sample < 0 || sample > 255)) {
		return res.status(400).json({ error: "Every sample must be an integer between 0 and 255" });
	}

	const cursors = fftService.processAudio(samples);

	console.log("cursors:", cursors);

	return res.status(200).json({ cursors });
});

function validateNotes(notes) {
	if (!Array.isArray(notes))
		return "Request body must be an array of notes";

	for (let i = 0; i < notes.length; i++) {
		const note = notes[i];
		if (!note || typeof note !== "object")
			return `Note at index ${i} must be an object`;
		if (typeof note.note !== "string" || !/^[A-G][#b]?-?\d+$/.test(note.note)) // change this i dont like using regex
			return `Note at index ${i} has an invalid note value`;
		if (typeof note.start !== "number" || !Number.isFinite(note.start) || note.start < 0)
			return `Note at index ${i} has an invalid start`;
		if (typeof note.end !== "number" || !Number.isFinite(note.end) || note.end <= note.start)
			return `Note at index ${i} has an invalid end`;
	}
	return null;
}