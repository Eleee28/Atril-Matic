import { osmd, elements, time, fileLoader } from "./script.js";
import { moveCursorNext } from "./cursor.js";

export function startPlay() {
    if (time.playTimeout !== null) return; // alerady playing

    scheduleNextCursorMove();
}

function scheduleNextCursorMove() {
    const iterator = osmd.cursor.iterator;

    if (iterator.EndReached) { // End of music sheet
        stopPlay();
        return;
    }

    const durationMs = getCurrentCursorDurationMs();

    time.playTimeout = setTimeout(() => {
        time.playTimeout = null;

        if (!moveCursorNext()) {
            stopPlay();
            return;
        }

        if (iterator.EndReached) {
            stopPlay();
            return;
        }
        scheduleNextCursorMove();
    }, durationMs);
}

// Calculate the duration of the actual note
function getCurrentCursorDurationMs() {

    const quarterNoteMs = 60000 / time.tempoBpm; // duration of a quarter note (negra) in relation to the tempo

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

export function stopPlay() {
    clearTimeout(time.playTimeout); // cancel pending timeout
    time.playTimeout = null;
}

export function resetPlayer() {
    clearTimeout(time.playTimeout);
    time.playTimeout = null;

    osmd.cursor.hide();

    elements.scoreDiv.innerHTML = "";

    elements.prevButton.disabled = true;
    elements.nextButton.disabled = true;
    elements.playButton.disabled = true;
    elements.stopButton.disabled = true;
    elements.tempoSlider.disabled = true;

    fileLoader.showUpload();
}