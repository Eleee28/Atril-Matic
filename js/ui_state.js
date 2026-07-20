export function showPlayer(uploadSection, playerSection) {
    uploadSection.hidden = true;
    playerSection.hidden = false;
}

export function showUpload(uploadSection, playerSection) {
    uploadSection.hidden = false;
    playerSection.hidden = true;
}

export function preventDefaultDragBehaviour(event) {
    event.preventDefault();
    event.stopPropagation();
}
