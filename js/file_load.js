import { osmd, elements, stats, time } from "./script.js";
import { showPlayer, showUpload, preventDefaultDragBehaviour } from "./ui_state.js";
import { countCursorPositions, updateStatistics } from "./statistics.js";
import { enableNoteClickNavigation } from "./cursor.js";

function isMusicXmlFile(file) {
    const filename = file.name.toLowerCase();

    return (filename.endsWith(".xml") || filename.endsWith(".musicxml"));
}

async function processFile(file, onFileSelected) {
    if (!file)
        return;
    if (!isMusicXmlFile(file)) {
        alert("Selecciona un archivo .xml o .musicxml");
        return;
    }

    showPlayer();

    try {
        await onFileSelected(file);
    } catch (error) {
        console.error("Error loading MusicXML: ", error);
        showUpload();
        alert("No se ha podido cargar la partitura");
        throw error;
    }
}

export function initializeFileLoader({onFileSelected}) {
    elements.fileInput.addEventListener("change", async (event) => {
        await processFile(event.target.files[0], onFileSelected);
    });

    // Avoid the browser open the file if droped outside the dropZone
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

        await processFile(event.dataTransfer.files[0], onFileSelected)
    });

    return { 
        showPlayer: () => showPlayer(),
        showUpload: () => showUpload(),
    };
}

export async function loadScore(file) {
    clearTimeout(time.playTimeout);
    time.playTimeout = null;

    const xml = await file.text();

    await osmd.load(xml);
    await osmd.render();
    
    osmd.cursor.show();
    osmd.cursor.reset();
    // styleOsmdCursorAsLine(); // Si se quiere modificar el estilo
    
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