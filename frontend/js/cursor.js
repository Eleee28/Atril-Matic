import { osmd } from "./init.js";
import { startPlay, stopPlay } from "./player.js";
import { elements, stats, time } from "./script.js";
import { updateStatistics } from "./statistics.js";

const MAX_CURSORS = 4;

// https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/blob/master/src/OpenSheetMusicDisplay/OSMDOptions.ts
export const cursorConfig = {
    /**
     * Type of cursor:
     * 0: Standard highlighting current notes
     * 1: Thin line left to the current notes
     * 2: Short thin line on top of stave and left to the current notes
     * 3: Current measure
     * 4: Current measure to left of current notes
     */
    type: 2,
    /** Color to draw the cursor */
    color: "#5182ea",
    /** alpha value to be used with color (0.0 transparent, 0.5 medium, 1.0 opaque). */
    alpha: 0.35,
    /** If true, this cursor will be followed (for scroll). */
    follow: true,
};

export const cursorsConfig = Array.from({ length: MAX_CURSORS }, () => ({
	type: 0,
	color: "#5182ea",
	alpha: 1,
	follow: false
}));

export function moveCursorNext() {
    if (osmd.cursor.iterator.EndReached)
        return false;

    osmd.cursor.next();

    if (stats.currentPosition < stats.totalPositions - 1)
        stats.currentPosition++;

    updateStatistics();

    return true;
}

export function moveCursorPrevious() {
    if (stats.currentPosition <= 0)
        return false;

    osmd.cursor.previous();
    stats.currentPosition--;

    updateStatistics();

    return true;
}

function clientToOsmdCoordinates(svg, clientX, clientY) {
    const svgPoint = svg.createSVGPoint();

    svgPoint.x = clientX;
    svgPoint.y = clientY;

    const tranformedPoint = svgPoint.matrixTransform(svg.getScreenCTM().inverse());

    const osmdUnitInSvgPixels = 10 * osmd.Zoom;

    return new opensheetmusicdisplay.PointF2D(
        tranformedPoint.x / osmdUnitInSvgPixels,
        tranformedPoint.y / osmdUnitInSvgPixels
    );
}

function setCursorToRealValue(targetRealValue) {
	osmd.cursor.reset();
	stats.currentPosition = 0;

	// Move forward only while the NEXT voice entry still starts at or before
	// the target, so the cursor lands on the entry that contains the target
	// time instead of jumping one entry ahead.
	while (!osmd.cursor.iterator.EndReached) {
		const nextIterator = osmd.cursor.iterator.clone();
		nextIterator.moveToNextVisibleVoiceEntry(false);

		if (nextIterator.EndReached)
			break;

		const nextTimestamp = nextIterator.currentTimeStamp?.realValue;

		if (typeof nextTimestamp !== "number" || nextTimestamp > targetRealValue)
			break;

		osmd.cursor.next();
		stats.currentPosition++;
	}

	osmd.cursor.show();
	updateStatistics();
}

function moveCursorToTimestamp(targetTimestamp) {
	const wasPlaying = time.playTimeout !== null;

	if (wasPlaying)
		stopPlay();

	setCursorToRealValue(targetTimestamp.realValue);

	if (wasPlaying)
		startPlay();
}

// Move the visual cursor to the position matched by the backend's real-time
// tracking. timestampMs is in the same units as the track sent to the backend
// (ms), so it maps back to OSMD musical time through msPerWholeNote.
export function followTimestampMs(timestampMs) {
	const msPerWholeNote = time.msPerWholeNote;

	if (!msPerWholeNote)
		return;

	stopPlay(); // real-time tracking supersedes tempo-driven playback

	setCursorToRealValue(timestampMs / msPerWholeNote);
}

function handleScoreClick(event) {
    const svg = event.currentTarget;

    const clickPosition = clientToOsmdCoordinates(svg, event.clientX, event.clientY);

    const maxClickDistance = new opensheetmusicdisplay.PointF2D(3, 3);

    const graphicalNote = osmd.GraphicSheet.GetNearestNote(clickPosition, maxClickDistance);
    if (!graphicalNote)
        return;

    const targetTimestamp = graphicalNote.sourceNote.getAbsoluteTimestamp();

    moveCursorToTimestamp(targetTimestamp);
}

export function enableNoteClickNavigation() {
    const svg = elements.scoreDiv.querySelector("svg");

    if (!svg) {
        console.warn("No se encontró el SVG de la partitura");
        return;
    }

    svg.addEventListener("click", handleScoreClick);
}