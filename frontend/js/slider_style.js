import { elements } from "./script.js";

export function updateTempoSliderProgress() {
    const min = Number(elements.tempoSlider.min);
    const max = Number(elements.tempoSlider.max);
    const value = Number(elements.tempoSlider.value);

    const percentage = ((value - min) / (max - min)) * 100;

    elements.tempoSlider.style.setProperty("--progress", `${percentage}%`)
}