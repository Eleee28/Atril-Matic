export function updateTempoSliderProgress(tempoSlider) {
    const min = Number(tempoSlider.min);
    const max = Number(tempoSlider.max);
    const value = Number(tempoSlider.value);

    const percentage = ((value - min) / (max - min)) * 100;

    tempoSlider.style.setProperty("--progress", `${percentage}%`)
}