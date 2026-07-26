import { startPlay, stopPlay } from "./player.js";
import { elements, osmd, stats, time } from "./script.js";
import { updateStatistics } from "./statistics.js";

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

export const cursorsConfig = [
	{
		type: 0,
		color: "#2563eb",
		alpha: 0.9,
		follow: true,
	},
	{
		type: 0,
		color: "#2563eb",
		alpha: 0.70,
		follow: true,
	},
	{
		type: 4,
		color: "#2563eb",
		alpha: 0.55,
		follow: true,
	},
	{
		type: 3,
		color: "#2563eb",
		alpha: 0.25,
		follow: true,
	},
];

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

function moveCursorToTimestamp(targetTimestamp) {
    const wasPlaying = time.playTimeout !== null;

    if (wasPlaying)
        stopPlay();

    osmd.cursor.reset();
    stats.currentPosition = 0;

    while (!osmd.cursor.iterator.EndReached) {
        const currentTimestamp = osmd.cursor.iterator.CurrentSourceTimestamp;
        if (currentTimestamp.realValue >= targetTimestamp.realValue)
            break;
        
        osmd.cursor.next();
        stats.currentPosition++;
    }

    osmd.cursor.show();
    updateStatistics();

    if (wasPlaying) {
        startPlay();
    }
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