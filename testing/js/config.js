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

export function getDefaultConfig() {
	return { ...DEFAULT_CONFIG };
}

function buildPitchAlgorithm(formValues) {
	const algorithmType = formValues.pitchAlgorithmType || formValues.pitchAlgorithm || "fft-peak";

	if (algorithmType === "fft-peak") {
		return {
			type: "fft-peak",
			magnitudeThreshold: formValues.magnitudeThreshold ?? 10,
		};
	} else if (algorithmType === "fft-harmonics" || algorithmType === "fft-peak-with-harmonics") {
		return {
			type: "fft-peak-with-harmonics",
			magnitudeThreshold: formValues.magnitudeThreshold ?? 10,
			maxHarmonicDivisor: formValues.maxHarmonicDivisor ?? 4,
			subharmonicThreshold: formValues.subharmonicThreshold ?? 0.5,
		};
	} else if (algorithmType === "hps") {
		return {
			type: "hps",
			magnitudeThreshold: formValues.magnitudeThreshold ?? 10,
		};
	} else if (algorithmType === "hps-with-harmonics" || algorithmType === "hpsWithHarmonics") {
		return {
			type: "hps-with-harmonics",
			magnitudeThreshold: formValues.magnitudeThreshold ?? 10,
			maxHarmonicDivisor: formValues.maxHarmonicDivisor ?? 4,
			subharmonicThreshold: formValues.subharmonicThreshold ?? 0.5,
		};
	} else if (algorithmType === "yin") {
		return {
			type: "yin",
			tauMin: formValues.tauMin ?? 1,
			tauMax: formValues.tauMax ?? 10,
			yinThreshold: formValues.yinThreshold ?? 0.15,
		};
	}

	return {
		type: "fft-peak",
		magnitudeThreshold: formValues.magnitudeThreshold ?? 10,
	};
}

export function getConfig() {
	const form = document.getElementById("configuration-form");
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

export function setConfig(config) {
	const form = document.getElementById("configuration-form");

	for (const [key, value] of Object.entries(config)) {
		if (key === "pitchAlgorithm" && typeof value === "object" && value !== null) {
			const algType = value.type;
			let type = algType;
			if (algType === "fft-peak-with-harmonics") type = "fft-harmonics";
			else if (algType === "hps-with-harmonics") type = "hps-with-harmonics";
			const field = form.elements.namedItem("pitchAlgorithmType");
			if (field) field.value = type === "fft-peak-with-harmonics" ? "fft-harmonics" : type === "hps-with-harmonics" ? "hps-with-harmonics" : algType;
			if (value.magnitudeThreshold !== undefined && form.elements.namedItem("magnitudeThreshold")) form.elements.namedItem("magnitudeThreshold").value = value.magnitudeThreshold;
			if (value.maxHarmonicDivisor !== undefined && form.elements.namedItem("maxHarmonicDivisor")) form.elements.namedItem("maxHarmonicDivisor").value = value.maxHarmonicDivisor;
			if (value.subharmonicThreshold !== undefined && form.elements.namedItem("subharmonicThreshold")) form.elements.namedItem("subharmonicThreshold").value = value.subharmonicThreshold;
			if (value.tauMin !== undefined && form.elements.namedItem("tauMin")) form.elements.namedItem("tauMin").value = value.tauMin;
			if (value.tauMax !== undefined && form.elements.namedItem("tauMax")) form.elements.namedItem("tauMax").value = value.tauMax;
			if (value.yinThreshold !== undefined && form.elements.namedItem("yinThreshold")) form.elements.namedItem("yinThreshold").value = value.yinThreshold;
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
		errors.push("Window size cannot be greater than FFT size.")

	if (config.hopSize > config.windowSize)
		errors.push("Hop size cannot be greater than window size.")

	if (config.minFrequency >= config.maxFrequency)
		errors.push("Minimum frequency must be lower than maximum frequency.")

	if (config.maxFrequency > config.sampleRate / 2)
		errors.push("Maximum frequency cannot exceed the Hyquist frequency (sample rate / 2).")

	const alg = config.pitchAlgorithm || {};
	if (alg.magnitudeThreshold !== undefined && alg.magnitudeThreshold < 0)
		errors.push("Magnitude threshold cannot be negative.")

	if (alg.subharmonicThreshold !== undefined && alg.subharmonicThreshold < 0)
		errors.push("Subharmonic threshold cannot be negative.")

	if (alg.yinThreshold !== undefined && alg.yinThreshold < 0)
		errors.push("YIN threshold cannot be negative.")

	if (config.queryCapacity < 1)
		errors.push("Query capacity must be greater than zero.")

	if (config.acceptThreshold < 0)
		errors.push("Accept threshold cannot be negative.")

	if (config.trackThreshold < 0)
		errors.push("Track threshold cannot be negative.")

	return errors;
}

export function updateValidationUI() {
	const config = getConfig();
	const errors = validateConfig(config);

	const container = document.getElementById("configuration-errors");

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

export function saveConfig(config) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function loadConfig() {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
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

export function resetConfig() {
	const config = getDefaultConfig();

	setConfig(config);
	saveConfig(config);

	return config;
}

function handleConfigChange() {
	const config = getConfig();

	saveConfig(config);
	updateValidationUI();
}

export function initializeConfig() {
	const form = document.getElementById("configuration-form");
	
	setConfig(loadConfig());

	form.addEventListener("input", handleConfigChange);

	form.addEventListener("change", handleConfigChange);

	form.addEventListener("reset", () => {
		event.preventDefault();
		resetConfig();
		updateValidationUI();
	});

	updateValidationUI();
}