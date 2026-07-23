import { osmd, elements, stats, time } from "./script.js";
import { showPlayer, showUpload, preventDefaultDragBehaviour } from "./ui_state.js";
import { countCursorPositions, updateStatistics } from "./statistics.js";
import { enableNoteClickNavigation } from "./cursor.js";
import { convertPdfToMusicXml } from "./audiforge.js";
import { showLoadingMessage, hideLoadingMessage } from "./loading_msg.js";

function supportedExtension(extension) {
	const extensions = ["xml", "musicxml", "pdf", "mxl"]
    return (extensions.includes(extension));
}

function getFileExtension(filename) {
	return filename.split(".").pop().toLowerCase();
}

async function loadFile(file, onFileSelected) {
	if (!file)
		return;

	const extension = getFileExtension(file.name);
	if (!supportedExtension(extension)) {
        alert("Archivo no soportado. Selecciona un archivo PDF, XML, MusicXML o MXL");
        return;
    }
	let musicxml = null;

	if (extension === "pdf") {
		showLoadingMessage("Converting PDF to MusicXML...");

		try {
			musicxml = await convertPdfToMusicXml(file);
		} finally {
			hideLoadingMessage();
		}
	}
	else if (extension === "xml" || extension === "musicxml")
		musicxml = await file.text();
	else if (extension === "mxl")
		musicxml = file;

	if (musicxml) {
		showPlayer();

		try {
			await onFileSelected(musicxml);
		} catch (error) {
			console.error("Error loading MusicXML: ", error);
			showUpload();
			alert("No se ha podido cargar la partitura");
			throw error;
		}
	}
}

export function initializeFileLoader({onFileSelected}) {
    elements.fileInput.addEventListener("change", async (event) => {
		const file = event.target.files[0];

		try {
			await loadFile(file, onFileSelected);
		} catch (error) {
			console.error("Could not load score: ", error);
		} finally {
			elements.fileInput.value = "";
		}
    });

    // Avoid the browser open the file if dropped outside the dropZone
    document.addEventListener("dragover", preventDefaultDragBehaviour);
    document.addEventListener("drop", preventDefaultDragBehaviour);

    elements.dropZone.addEventListener("dragenter", (event) => {
        preventDefaultDragBehaviour(event);
        elements.dropZone.classList.add("is-dragging");
    });

    elements.dropZone.addEventListener("dragover", (event) => {
        preventDefaultDragBehaviour(event);
        elements.dropZone.classList.add("is-dragging");
    });

    elements.dropZone.addEventListener("dragleave", (event) => {
        preventDefaultDragBehaviour(event);

        // Avoid removing the style when going over childs of dropZone
        if (!elements.dropZone.contains(event.relatedTarget))
            elements.dropZone.classList.remove("is-dragging");
    });

    elements.dropZone.addEventListener("drop", async (event) => {
        preventDefaultDragBehaviour(event);
        elements.dropZone.classList.remove("is-dragging");

		const file = event.dataTransfer.files[0];

		try {
			await loadFile(file, onFileSelected);
		} catch (error) {
			console.error("Could not load score: ", error);
		} finally {
			elements.fileInput.value = "";
		}
    });

    return { 
        showPlayer: () => showPlayer(),
        showUpload: () => showUpload(),
    };
}

export async function loadScore(scoreData) {
    clearTimeout(time.playTimeout);
    time.playTimeout = null;


    await osmd.load(scoreData);
    await osmd.render();
    
    osmd.cursor.show();
    osmd.cursor.reset();
    
    stats.currentPosition = 0;
    stats.totalPositions = countCursorPositions();
    
    enableNoteClickNavigation();
    updateStatistics();

    elements.prevButton.disabled = false;
    elements.nextButton.disabled = false;
    elements.playButton.disabled = false;
    elements.stopButton.disabled = false;
    elements.tempoSlider.disabled = false;
}