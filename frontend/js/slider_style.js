import { elements } from "./script.js";

export function onTempoChanged() {
	const wasPlaying = time.playTimeout !== null; // Avoid playing when tempo is modified if it was stopped

    time.tempoBpm = Number(elements.tempoSlider.value);
    elements.tempoValue.textContent = `${time.tempoBpm} BPM`;

    updateTempoSliderProgress();
    updateStatistics();

    if (wasPlaying) {
        stopPlay();
        startPlay();
    }
}

export function updateTempoSliderProgress() {
    const min = Number(elements.tempoSlider.min);
    const max = Number(elements.tempoSlider.max);
    const value = Number(elements.tempoSlider.value);

    const percentage = ((value - min) / (max - min)) * 100;

    elements.tempoSlider.style.setProperty("--progress", `${percentage}%`)
}