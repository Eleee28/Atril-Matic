import { init } from "./init.js";

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

init(elements);