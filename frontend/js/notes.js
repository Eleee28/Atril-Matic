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
	const noteMap = {
		0: "C", // Do
		2: "D", // Re
		4: "E", // Mi
		5: "F", // Fa
		7: "G", // Sol
		9: "A", // La
		11: "B" // Si
	};

	const accidentalNames = {
		5: "bb", // Doubleflat (doble bemol)
		1: "b", // Flat (bemol)
		3: "", // Natural (becuadro) same as none
		2: "", // None
		0: "#", // Sharp (sostenido)
		4: "##" // Doublesharp (doble sostenido)
	};

	const octaves = {
		[-3]: 0,
		[-2]: 1,
		[-1]: 2,
		[0]: 3,
		[1]: 4,
		[2]: 5,
		[3]: 6,
		[4]: 7,
		[5]: 8,
		[6]: 9
	};

	const noteName = noteMap[pitch.fundamentalNote];
	const accidental = accidentalNames[pitch.accidental] ?? "";
	const octave = octaves[pitch.octave];

	// console.log("pitch: ", pitch); // DEBUG
	// console.log("note: ", noteName);

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