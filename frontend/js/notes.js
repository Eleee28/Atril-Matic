import { time } from "./script.js";

export async function initNotes(sheet) {
	const notes = buildNotesArray(sheet);

	const audioContext = new AudioContext();
	const sampleRate = audioContext.sampleRate;

	const fftSize = 2048;

	await sendNotes(notes, sampleRate, fftSize);
}

function buildNotesArray(sheet) {
	const notes = [];
	const msPerWholeNote = (60000 / time.tempoBpm) * 4;

	for (const measure of sheet.sourceMeasures) {
		for (const container of measure.verticalSourceStaffEntryContainers) {
			for (const staffEntry of container.staffEntries) {
				if (!staffEntry)
					continue;

				for (const voiceEntry of staffEntry.voiceEntries) {
					const startMusicalTime = measure.absoluteTimestamp.realValue + voiceEntry.timestamp.realValue;

					for (const note of voiceEntry.notes) {
						if (!note.pitch) // rests do not have pitch
							continue;
						
						const durationMusicalTime = note.length.realValue;

						const start = Math.round(startMusicalTime * msPerWholeNote);
						const end = Math.round((startMusicalTime + durationMusicalTime) * msPerWholeNote);

						notes.push({
							note: pitchToString(note.pitch),
							start,
							end
						});
					}
				}
			}
		}
	}
	return notes;
}

function pitchToString(pitch) {
	const noteNames = [
		"C",
		"D",
		"E",
		"F",
		"G",
		"A",
		"B"
	];

	const accidentalNames = {
		[-2]: "bb",
		[-1]: "b",
		[0]: "",
		[1]: "#",
		[2]: "##"
	};

	const noteName = noteNames[pitch.fundamentalNote];
	const accidental = accidentalNames[pitch.accidental] ?? "";
	const octave = pitch.octave;

	return `${noteName}${accidental}${octave}`;
}

async function sendNotes(notes, sampleRate, fftSize) {
	const response = await fetch("http://localhost:3000/api/notes", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			notes,
			sampleRate,
			fftSize
		})
	});

	if (!response.ok)
		throw new Error(`Notes request failed: ${response.status}`);

	const result = await response.json();
	console.log(result);
}