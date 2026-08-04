import { osmd } from "./init.js";
import { elements, time, stats } from "./script.js";

export function countCursorPositions() {
    const iterator = osmd.cursor.iterator.clone();

    let count = 0;

    while (!iterator.EndReached) {
        count++;
        iterator.moveToNextVisibleVoiceEntry();
    }
    return count;
}

export function updateStatistics() {
    const iterator = osmd.cursor.iterator;

    elements.positionStat.textContent = `${stats.currentPosition + 1} / ${stats.totalPositions}`;

    if (iterator.EndReached) {
        elements.measureStat.textContent = "-";
    } else {
        elements.measureStat.textContent = iterator.CurrentMeasureIndex + 1;
    }

    elements.tempoStat.textContent = `${time.tempoBpm} BPM`;
}