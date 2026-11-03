const STORAGE_KEY = "atril-matic-testing-config";

const DEFAULT_CONFIG = {
	sampleRate: 48000,
	fftSize: 2048,
	windowSize: 2048,
	hopSize: 512,
	windowFunction: "hann",

	pitchAlgorithmType: "fft-peak",
	minFrequency: 60,
	maxFrequency: 2000,
	magnitudeThreshold: 10,
	maxHarmonicDivisor: 4,
	subharmonicThreshold: 0.5,
	tauMin: 1,
	tauMax: 10,
	yinThreshold: 0.15,

	queryCapacity: 50,
	acceptThreshold: 1.5,
	trackThreshold: 0.9,
	slack: 2,
	recoverAfter: 5,
};

const NUMERIC_FIELDS = new Set([
	"sampleRate",
	"fftSize",
	"windowSize",
	"hopSize",
	"minFrequency",
	"maxFrequency",
	"magnitudeThreshold",
	"maxHarmonicDivisor",
	"subharmonicThreshold",
	"tauMin",
	"tauMax",
	"yinThreshold",
	"queryCapacity",
	"acceptThreshold",
	"trackThreshold",
	"slack",
	"recoverAfter",
]);

function getDefaultForm() {
	return document.getElementById("configuration-form");
}

export function getDefaultConfig() {
	return { ...DEFAULT_CONFIG };
}

function buildPitchAlgorithm(formValues) {
	const algorithmType = formValues.pitchAlgorithmType || formValues.pitchAlgorithm || "fft-peak";

	if (algorithmType === "fft-peak") {
		return {
			type: "fft-peak",
			magnitudeThreshold: formValues.magnitudeThreshold ?? DEFAULT_CONFIG.magnitudeThreshold,
		};
	}
	else if (algorithmType === "fft-harmonics" || algorithmType === "fft-peak-with-harmonics") {
		return {
			type: "fft-peak-with-harmonics",
			magnitudeThreshold: formValues.magnitudeThreshold ?? DEFAULT_CONFIG.magnitudeThreshold,
			maxHarmonicDivisor: formValues.maxHarmonicDivisor ?? DEFAULT_CONFIG.maxHarmonicDivisor,
			subharmonicThreshold: formValues.subharmonicThreshold ?? DEFAULT_CONFIG.subharmonicThreshold,
		};
	}
	else if (algorithmType === "hps") {
		return {
			type: "hps",
			magnitudeThreshold: formValues.magnitudeThreshold ?? DEFAULT_CONFIG.magnitudeThreshold,
		};
	}
	else if (algorithmType === "hps-with-harmonics" || algorithmType === "hpsWithHarmonics") {
		return {
			type: "hps-with-harmonics",
			magnitudeThreshold: formValues.magnitudeThreshold ?? DEFAULT_CONFIG.magnitudeThreshold,
			maxHarmonicDivisor: formValues.maxHarmonicDivisor ?? DEFAULT_CONFIG.maxHarmonicDivisor,
			subharmonicThreshold: formValues.subharmonicThreshold ?? DEFAULT_CONFIG.subharmonicThreshold,
		};
	}
	else if (algorithmType === "yin") {
		return {
			type: "yin",
			tauMin: formValues.tauMin ?? DEFAULT_CONFIG.tauMin,
			tauMax: formValues.tauMax ?? DEFAULT_CONFIG.tauMax,
			yinThreshold: formValues.yinThreshold ?? DEFAULT_CONFIG.yinThreshold,
		};
	}

	return {
		type: "fft-peak",
		magnitudeThreshold: formValues.magnitudeThreshold ?? DEFAULT_CONFIG.magnitudeThreshold,
	};
}

export function getConfig(form = getDefaultForm()) {
	const formData = new FormData(form);

	const formValues = {};

	for (const [key, value] of formData.entries()) {
		formValues[key] = NUMERIC_FIELDS.has(key) ? Number(value) : value;
	}

	const config = {
		sampleRate: formValues.sampleRate,
		fftSize: formValues.fftSize,
		windowSize: formValues.windowSize,
		hopSize: formValues.hopSize,
		windowFunction: formValues.windowFunction,
		pitchAlgorithm: buildPitchAlgorithm(formValues),
		minFrequency: formValues.minFrequency,
		maxFrequency: formValues.maxFrequency,
		queryCapacity: formValues.queryCapacity,
		acceptThreshold: formValues.acceptThreshold,
		trackThreshold: formValues.trackThreshold,
		slack: formValues.slack,
		recoverAfter: formValues.recoverAfter,
	};
	return config;
}

export function setConfig(config, form = getDefaultForm()) {

	for (const [key, value] of Object.entries(config)) {
		if (key === "pitchAlgorithm" && typeof value === "object" && value != null) {
			const algType = value.type;
			let type = algType;
			if (algType === "fft-peak-with-harmonics")
				type = "fft-harmonics";
			
			const field = form.elements.namedItem("pitchAlgorithmType");
			if (field)
				field.value = type;
			if (value.magnitudeThreshold !== undefined && form.elements.namedItem("magnitudeThreshold"))
				form.elements.namedItem("magnitudeThreshold").value = value.magnitudeThreshold;
			if (value.maxHarmonicDivisor !== undefined && form.elements.namedItem("maxHarmonicDivisor"))
				form.elements.namedItem("maxHarmonicDivisor").value = value.maxHarmonicDivisor;
			if (value.subharmonicThreshold !== undefined && form.elements.namedItem("subharmonicThreshold"))
				form.elements.namedItem("subharmonicThreshold").value = value.subharmonicThreshold;
			if (value.tauMin !== undefined && form.elements.namedItem("tauMin"))
				form.elements.namedItem("tauMin").value = value.tauMin;
			if (value.tauMax !== undefined && form.elements.namedItem("tauMax"))
				form.elements.namedItem("tauMax").value = value.tauMax;
			if (value.yinThreshold !== undefined && form.elements.namedItem("yinThreshold"))
				form.elements.namedItem("yinThreshold").value = value.yinThreshold;
			continue;
		}
		const field = form.elements.namedItem(key);
		if (field)
			field.value = value;
	}
}

export function validateConfig(config) {
	const errors = [];

	if (config.windowSize > config.fftSize)
		errors.push("Window size cannot be greater than FFT size.");

	if (config.hopSize > config.windowSize)
		errors.push("Hop size cannot be greater than window size.");

	if (config.minFrequency >= config.maxFrequency)
		errors.push("Minimum frequency must be lower than maximum frequency.");

	if (config.maxFrequency > config.sampleRate / 2)
		errors.push("Maximum frequency cannot exceed the Hyquist frequency (sample rate / 2).");

	const alg = config.pitchAlgorithm || {};

	if (alg.magnitudeThreshold !== undefined && alg.magnitudeThreshold < 0)
		errors.push("Magnitude threshold cannot be negative.");

	if (alg.subharmonicThreshold !== undefined && alg.subharmonicThreshold < 0)
		errors.push("Subharmonic threshold cannot be negative.");

	if (alg.yinThreshold !== undefined && alg.yinThreshold < 0)
		errors.push("YIN threshold cannot be negative.");

	if (config.queryCapacity < 1)
		errors.push("Query capacity must be greater than zero.");

	if (config.acceptThreshold < 0)
		errors.push("Accept threshold cannot be negative.");

	if (config.trackThreshold < 0)
		errors.push("Track threshold cannot be negative.");

	return errors;
}

export function updateValidationUI(form = getDefaultForm()) {
	const config = getConfig(form);
	const errors = validateConfig(config);

	const container = form.querySelector(".configuration-errors");

	if (errors.length === 0) {
		container.hidden = true;
		container.replaceChildren();
		return true;
	}

	container.hidden = false;

	const list = document.createElement("ul");

	for (const error of errors) {
		const item = document.createElement("li");
		item.textContent = error;
		list.appendChild(item);
	}

	container.replaceChildren(list);

	return false;
}

export function saveConfig(config, storageKey = STORAGE_KEY) {
	localStorage.setItem(storageKey, JSON.stringify(config));
}

export function loadConfig(storageKey = STORAGE_KEY) {
	try {
		const stored = localStorage.getItem(storageKey);
		if (!stored)
			return getDefaultConfig();

		return {
			...getDefaultConfig(),
			...JSON.parse(stored),
		}
	} catch (error) {
		console.error("Failed to load configuration: ", error);
		return getDefaultConfig();
	}
}

export function resetConfig(form = getDefaultForm(), storageKey = STORAGE_KEY) {
	const config = getDefaultConfig();

	setConfig(config, form);
	saveConfig(config, storageKey);

	return config;
}

export function handleConfigChange(form = getDefaultForm(), storageKey = STORAGE_KEY) {
	const config = getConfig(form);

	saveConfig(config, storageKey);
	updateValidationUI(form);
}

export function initializeConfig(form = getDefaultForm(), storageKey = STORAGE_KEY) {

	setConfig(loadConfig(storageKey), form);

	const onChange = () => handleConfigChange(form, storageKey);

	form.addEventListener("input", onChange);

	form.addEventListener("change", onChange);

	form.addEventListener("reset", (event) => {
		event.preventDefault();
		resetConfig(form, storageKey);
		updateValidationUI(form);
	});

	updateValidationUI(form);
}