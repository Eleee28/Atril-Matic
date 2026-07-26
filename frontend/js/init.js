import { cursorsConfig, moveCursorNext, moveCursorPrevious } from "./cursor.js";
import { initializeFileLoader, loadScore } from "./file_load.js";
import { updateTempoSliderProgress, onTempoChanged } from "./slider_style.js";
import { startPlay, stopPlay, resetPlayer } from "./player.js";

export let fileLoader;
export let osmd;

export function init(elements) {
	// Initialize file loader
	fileLoader = initializeFileLoader({
		onFileSelected: async (file) => {
			await loadScore(file);
		}
	});

	// Initialize slider track
	updateTempoSliderProgress(elements.tempoSlider);

	// OSMD doc: https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/wiki/Getting-Started
	osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(elements.scoreDiv, {
		backend: "svg",
		drawTitle: true,
		followCursor: true,
		cursorsOptions: cursorsConfig,
		// drawingParameters: "compacttight" // don't display title, composer etc., smaller margins
	});

	// Event listeners

	elements.openFileButton.addEventListener("click", resetPlayer);

	elements.nextButton.addEventListener("click", moveCursorNext);

	elements.prevButton.addEventListener("click", moveCursorPrevious);

	elements.playButton.addEventListener("click", startPlay);

	elements.stopButton.addEventListener("click", stopPlay);

	elements.tempoSlider.addEventListener("input", onTempoChanged);

	document.addEventListener("keydown", onKeyDown);
}

function onKeyDown() {
	if (event.key === "Escape")
		stopPlay();
}