export function showPlayer(uploadSection, playerSection) {
    uploadSection.hidden = true;
    playerSection.hidden = false;
}

export function showUpload(uploadSection, playerSection, fileInput) {
    uploadSection.hidden = false;
    playerSection.hidden = true;

    fileInput.value = "";
}

export function preventDefaultDragBehaviour(event) {
    event.preventDefault();
    event.stopPropagation();
}
