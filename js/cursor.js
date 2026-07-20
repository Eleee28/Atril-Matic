import { osmd, stats } from "./script.js";
import { updateStatistics } from "./statistics.js";

export function moveCursorNext() {
    if (osmd.cursor.iterator.EndReached)
        return false;

    osmd.cursor.next();

    if (stats.currentPosition < stats.totalPositions - 1)
        stats.currentPosition++;

    // styleOsmdCursorAsBand();
    updateStatistics();

    return true;
}

export function moveCursorPrevious() {
    if (stats.currentPosition <= 0)
        return false;

    osmd.cursor.previous();
    stats.currentPosition--;

    // styleOsmdCursorAsBand();
    updateStatistics();

    return true;
}

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