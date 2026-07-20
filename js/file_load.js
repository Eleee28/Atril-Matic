import { showPlayer, showUpload, preventDefaultDragBehaviour } from "./ui_state.js";

function isMusicXmlFile(file) {
    const filename = file.name.toLowerCase();

    return (filename.endsWith(".xml") || filename.endsWith(".musicxml"));
}

async function processFile(file, onFileSelected, uploadSection, playerSection, fileInput) {
    if (!file)
        return;
    if (!isMusicXmlFile(file)) {
        alert("Selecciona un archivo .xml o .musicxml");
        return;
    }

    showPlayer(uploadSection, playerSection);

    try {
        await onFileSelected(file);
    } catch (err) {
        console.error("Error loading MusicXML: ", error);
        showUpload(uploadSection, playerSection, fileInput);
        alert("No se ha podido cargar la partitura");
        throw err;
    }
}

export function initializeFileLoader({
    fileInput,
    dropZone,
    uploadSection,
    playerSection,
    onFileSelected
}) {
    fileInput.addEventListener("change", async (event) => {
        await processFile(event.target.files[0], onFileSelected, uploadSection, playerSection);
    });

    // Avoid the browser open the file if droped outside the dropZone
    document.addEventListener("dragover", preventDefaultDragBehaviour);
    document.addEventListener("drop", preventDefaultDragBehaviour);

    dropZone.addEventListener("dragenter", (event) => {
        preventDefaultDragBehaviour(event);
        dropZone.classList.add("is-dragging");
    });

    dropZone.addEventListener("dragover", (event) => {
        preventDefaultDragBehaviour(event);
        dropZone.classList.add("is-dragging");
    });

    dropZone.addEventListener("dragleave", (event) => {
        preventDefaultDragBehaviour(event);

        // Avoid removing the style when going over childs of dropZone
        if (!dropZone.contains(event.relatedTarget))
            dropZone.classList.remove("is-dragging");
    });

    dropZone.addEventListener("drop", async (event) => {
        preventDefaultDragBehaviour(event);
        dropZone.classList.remove("is-dragging");

        await processFile(event.dataTransfer.files[0], onFileSelected, uploadSection, playerSection)
    });

    return { 
        showPlayer: () => showPlayer(uploadSection, playerSection),
        showUpload: () => showUpload(uploadSection, playerSection, fileInput),
    };
}