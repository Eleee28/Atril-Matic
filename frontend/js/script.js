// import { styleOsmdCursorAsLine, styleOsmdCursorAsBand } from "./cursor_style.js";
import { cursorConfig, moveCursorNext, moveCursorPrevious } from "./cursor.js";
import { initializeFileLoader, loadScore } from "./file_load.js";
import { updateTempoSliderProgress } from "./slider_style.js";
import { updateStatistics } from "./statistics.js";
import { startPlay, stopPlay, resetPlayer } from "./player.js";

// HTML elements

export const elements = {
    fileInput: document.getElementById("file-input"),
    dropZone: document.getElementById("drop-zone"),

    uploadSection: document.getElementById("upload-section"),
    playerSection: document.getElementById("player-section"),

    scoreDiv: document.getElementById("score"),

    openFileButton: document.getElementById("open-file-button"),
    prevButton: document.getElementById("prev-button"),
    nextButton: document.getElementById("next-button"),
    playButton: document.getElementById("play-button"),
    stopButton: document.getElementById("stop-button"),

    tempoSlider: document.getElementById("tempo-slider"),
    tempoValue: document.getElementById("tempo-value"),

    positionStat: document.getElementById("position-stat"),
    measureStat: document.getElementById("measure-stat"),
    tempoStat: document.getElementById("tempo-stat"),
};

export const time = {
    // playTimeout is the ID returned by setTimeout(), used to:
    // - know if it is playing 
    // - be able to cancel the next cursor advance
    playTimeout: null, // no timeout
    tempoBpm: 120,
};

export const stats = {
    currentPosition: 0,
    totalPositions: 0,
};

// Initialize file loader
export const fileLoader = initializeFileLoader({
    onFileSelected: async (file) => {
        await loadScore(file);
    }
})

// Initialize slider track
updateTempoSliderProgress(elements.tempoSlider);

// OSMD doc: https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/wiki/Getting-Started
export const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(elements.scoreDiv);

osmd.setOptions({
    backend: "svg",
    drawTitle: true,
	followCursor: true,
	cursorOptions: [
		{
			type: cursorConfig.type,
			color: cursorConfig.color,
			alpha: cursorConfig.alpha,
			follow: cursorConfig.follow,
		},
	],
    // drawingParameters: "compacttight" // don't display title, composer etc., smaller margins
});

// Event listeners

elements.openFileButton.addEventListener("click", resetPlayer);

elements.nextButton.addEventListener("click", () => {
    // console.log("Cursor next");
    moveCursorNext();
});

elements.prevButton.addEventListener("click", () => {
    // console.log("Cursor prev");
    moveCursorPrevious();
});

elements.playButton.addEventListener("click", () => {
    startPlay();
});

elements.stopButton.addEventListener("click", () => {
    stopPlay();
});

elements.tempoSlider.addEventListener("input", () => {
    const wasPlaying = time.playTimeout !== null; // Avoid playing when tempo is modified if it was stopped

    time.tempoBpm = Number(elements.tempoSlider.value);
    elements.tempoValue.textContent = `${time.tempoBpm} BPM`;

    updateTempoSliderProgress();
    updateStatistics();

    if (wasPlaying) {
        stopPlay();
        startPlay();
    }
});

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape")
		stopPlay();
});