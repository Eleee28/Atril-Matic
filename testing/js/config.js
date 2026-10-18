const STORAGE_KEY = "atril-matic-testing-config";

const DEFAULT_CONFIG = {
	sampleRate: 48000,
	fftSize: 2048,
	windowSize: 2048,
	hopSize: 512,
	windowFunction: "hann",

	pitchAlgorithm: "fft-peak",
	minFrequency: 60,
	maxFrequency: 2000,
	magnitudeThreshold: 10,
	maxHarmonicDivisor: 4,
	subharmonicThreshold: 0.5,

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
	"queryCapacity",
	"acceptThreshold",
	"trackThreshold",
	"slack",
	"recoverAfter",
]);

export function getDefaultConfig() {
	return { ...DEFAULT_CONFIG };
}

export function getConfig() {
	const form = document.getElementById("configuration-form");
	const formData = new FormData(form);

	const config = {};

	for (const [key, value] of formData.entries()) {
		config[key] = NUMERIC_FIELDS.has(key) ? Number(value) : value;
	}
	return config;
}

export function setConfig(config) {
	const form = document.getElementById("configuration-form");

	for (const [key, value] of Object.entries(config)) {
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

	if (config.magnitudeThreshold < 0)
		errors.push("Magnitude threshold cannot be negative.")

	if (config.subharmonicThreshold < 0)
		errors.push("Subharmonic threshold cannot be negative.")

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