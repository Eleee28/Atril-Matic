import { Router } from "express";
import { fftService } from "../services/fft-service.js";

export const trackingRouter = Router();

trackingRouter.post("/notes", (req, res) => {
	const notes = req.body;

	const validationError = validateNotes(notes);
	if (validationError)
		return res.status(400).json({ error: validationError });

	fftService.setNotes(notes);

	return res.status(200).json({ message: "Notes received", noteCount: notes.length });
});

trackingRouter.post("/listened-audio", (req, res) => {
	const { samples } = req.body;

	if (!Array.isArray(samples))
		return res.status(400).json({ error: "samples must be an array" });

	if (samples.some(sample => !Number.isInteger(sample) || sample < 0 || sample > 255)) {
		return res.status(400).json({ error: "Every sample must be an integer between 0 and 255" });
	}

	const cursors = fftService.processAudio(samples);

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