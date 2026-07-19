// import { styleOsmdCursorAsLine, styleOsmdCursorAsBand } from "./cursor_style";

// HTML elements
const fileInput = document.getElementById("file-input");
const scoreDiv = document.getElementById("score");

const prevButton = document.getElementById("prev-button");
const nextButton = document.getElementById("next-button");
const playButton = document.getElementById("play-button");
const stopButton = document.getElementById("stop-button");
const tempoSlider = document.getElementById("tempo-slider");
const tempoValue = document.getElementById("tempo-value");

// playTimeout is the ID returned by setTimeout(), used to:
// - know if it is playing 
// - be able to cancel the next cursor advance
let playTimeout = null; // no timeout
let tempoBpm = 120;

// OSMD doc: https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/wiki/Getting-Started
const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(scoreDiv);

osmd.setOptions({
    backend: "svg",
    drawTitle: true,
    // drawingParameters: "compacttight" // don't display title, composer etc., smaller margins
});

// Event listeners

fileInput.addEventListener("change", async (event) => {
    clearTimeout(playTimeout);
    playTimeout = null;

    const file = event.target.files[0];
    if (!file) return;

    const xml = await file.text();

    await osmd.load(xml);
    await osmd.render();

    osmd.cursor.show();
    osmd.cursor.reset();
    // styleOsmdCursorAsLine(); // Si se quiere modificar el estilo

    prevButton.disabled = false;
    nextButton.disabled = false;
    playButton.disabled = false;
    stopButton.disabled = false;
    tempoSlider.disabled = false;
});

nextButton.addEventListener("click", () => {
    // console.log("Cursor next");
    osmd.cursor.next();
});

prevButton.addEventListener("click", () => {
    // console.log("Cursor prev");
    osmd.cursor.previous();
});

playButton.addEventListener("click", () => {
    startPlay();
});

stopButton.addEventListener("click", () => {
    stopPlay();
});

tempoSlider.addEventListener("input", () => {
    const wasPlaying = playTimeout !== null; // Avoid playing when tempo is modified if it was stopped

    tempoBpm = Number(tempoSlider.value);
    tempoValue.textContent = `${tempoBpm} BPM`;

    if (wasPlaying) {
        stopPlay();
        startPlay();
    }
});

function startPlay() {
    if (playTimeout !== null) return; // alerady playing

    scheduleNextCursorMove();
}

function scheduleNextCursorMove() {
    const iterator = osmd.cursor.iterator;

    if (iterator.EndReached) { // End of music sheet
        stopPlay();
        return;
    }

    const durationMs = getCurrentCursorDurationMs();

    playTimeout = setTimeout(() => {
        osmd.cursor.next();
        playTimeout = null;

        if (iterator.EndReached) {
            stopPlay();
            return;
        }
        scheduleNextCursorMove();
    }, durationMs);
}

// Calculate the duration of the actual note
function getCurrentCursorDurationMs() {

    const quarterNoteMs = 60000 / tempoBpm; // duration of a quarter note (negra) in relation to the tempo

    const currentIterator = osmd.cursor.iterator;

    // console.log("currentIterator: ", currentIterator); // DEBUG

    const currentTime = currentIterator.currentTimeStamp?.realValue;
    if (typeof currentTime !== "number")
        return quarterNoteMs;

    // Copy to avoid modyfing the current cursor
    const nextIterator = currentIterator.clone();

    // Same as osmd.cursor.next()
    nextIterator.moveToNextVisibleVoiceEntry(false);

    let durationInWholeNotes;

    if (!nextIterator.EndReached) { // Not the end of music sheet
        const nextTime = nextIterator.currentTimeStamp?.realValue;

        if (typeof nextTime === "number" || nextTime > currentTime)
            durationInWholeNotes = nextTime - currentTime;
    }
    
    // If there are no more notes, get real note duration from Note.realValue
    if (typeof durationInWholeNotes !== "number")
        durationInWholeNotes = getCurrentNoteDuration();

    if (typeof durationInWholeNotes !== "number") // In case of error
        return quarterNoteMs;

    // RealValue is expressed using a whole note as reference, obtain how many quarters it represents
    const durationMs = durationInWholeNotes * 4 * quarterNoteMs;
    
    // console.log({
    //     currentTime,
    //     durationInWholeNotes,
    //     durationMs,
    //     isLastPosition: nextIterator.EndReached,
    // }); // DEBUG

    return durationMs;
}

function getCurrentNoteDuration() {
    // In OSMD each note (VoiceEntry) has a Timestamp (relative timestamp within the source measure), realValue is a fraction representing its duration in music units:
    // VoiceEntry code here: https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/blob/master/src/MusicalScore/VoiceData/VoiceEntry.ts 
    // - Whole note (redonda): 1
    // - Half note (blanca): 1/2
    // - Quarter note (negra): 1/4
    // - Eighth note (corchea): 1/8
    // - Sixteenth note (semicorchea): 1/16

    const entries = osmd.cursor.iterator.CurrentVisibleVoiceEntries();

    if (!entries || entries.length === 0)
        return null;

    // console.log("entries: ", entries); // DEBUG

    // Use .filter to filter out invalid values
    const durations = entries.flatMap((entry) => entry?.Notes ?? [])
        .map((note) => note?.Length?.realValue)
        .filter(
            (duration) => typeof duration === "number" && duration > 0
        );

    if (durations.length === 0)
        return null;

    return Math.min(...durations);
}

function stopPlay() {
    clearTimeout(playTimeout); // cancel pending timeout
    playTimeout = null;
}