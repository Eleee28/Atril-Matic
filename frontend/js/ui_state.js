import { elements } from "./script.js";

export function showPlayer() {
    elements.uploadSection.hidden = true;
    elements.playerSection.hidden = false;
}

export function showUpload() {
    elements.uploadSection.hidden = false;
    elements.playerSection.hidden = true;

    elements.fileInput.value = "";
}

export function preventDefaultDragBehaviour(event) {
    event.preventDefault();
    event.stopPropagation();
}
