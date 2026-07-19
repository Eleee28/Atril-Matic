// Prueba estilos de cursores
export function styleOsmdCursorAsLine() {
    const cursorElement = document.getElementById("cursorImg-0");

    if (!cursorElement) {
        console.warn("Cursor not found");
        return;
    }

    cursorElement.style.backgroundColor = "#0066ff"
    cursorElement.style.width = "3px";
    cursorElement.style.opacity = "1";
    cursorElement.style.borderRadius = "2px";
}

export function styleOsmdCursorAsBand() {
    const cursorElement = document.getElementById("cursorImg-0");

    if (!cursorElement) {
        console.warn("Cursor not found");
        return;
    }

    cursorElement.style.backgroundColor = "#0066ff"
    cursorElement.style.width = "18px";
    cursorElement.style.opacity = "1";
    cursorElement.style.borderRadius = "6px";
}