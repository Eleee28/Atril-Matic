const TESTS_BASE_URL = new URL("../tests/", import.meta.url);

const SUPPORTED_TEST_TYPES = new Set([
	"pitch-detection",
	"audio-recognition",
	"score-tracking",
]);

export function validateTest(test) {
	if (!test || typeof test !== "object" || Array.isArray(test))
		throw new Error("Test must be a JSON object.");

	if (typeof test.id !== "string" || !test.id.trim())
		throw new Error("Test must have a valid id.");

	if (typeof test.name !== "string" || !test.name.trim())
		throw new Error("Test must have a valid name.");

	if (!SUPPORTED_TEST_TYPES.has(test.type))
		throw new Error(`Unsupported test type: ${test.type}.`);

	if (!test.input || typeof test.input !== "object")
		throw new Error("Test must define an input.");

	if (!test.expected || typeof test.expected !== "object")
		throw new Error("Test must define expected results.");

	if (test.type === "pitch-detection") {
		const frequencies = test.input.frequencies;
		const notes = test.expected.notes;

		if (test.input.type !== "sine")
			throw new Error("Pitch detection input must be a sine wave.");

		if (!Array.isArray(frequencies) || frequencies.length === 0)
			throw new Error("Frequencies must be a non-empty array.");

		if (!Array.isArray(notes) || notes.length !== frequencies.length)
			throw new Error("Expencted notes must have the same length as frequencies.");

		if (frequencies.some(f => !Number.isFinite(f) || f <= 0))
			throw new Error("All frequencies must be positive numbers.");

		if (notes.some(note => typeof note !== "string" || !note.trim()))
			throw new Error("All expected notes must be valid strings.");

		if (!Number.isFinite(test.input.durationMs) ||
			test.input.durationMs <= 0)
			throw new Error("Invalid duration.");
	}

	if (test.type === "audio-recognition" || test.type === "score-tracking") {
		if (typeof test.input.audioFile !== "string") 
			throw new Error("Audio tests must define an audioFile.");
	}

	return test;
}

export async function loadTest(url) {
	const response = await fetch(url);

	if (!response.ok)
		throw new Error(`Failed to load test: ${response.status} ${response.statusText}`);

	const test = validateTest(await response.json());

	const baseUrl = new URL(url, window.location.href);

	if (test.input.audioFile)
		test.input.audioFile = new URL(test.input.audioFile, baseUrl).href;

	if (test.input.scoreFile)
		test.input.scoreFile = new URL(test.input.scoreFile, baseUrl).href;

	return test;
}

export async function loadPredefinedTests() {
	const manifestUrl = new URL("manifest.json", TESTS_BASE_URL);

	const response = await fetch(manifestUrl);

	if (!response.ok)
		throw new Error("Failed to load tests manifest.");

	const manifest = await response.json();

	if (!Array.isArray(manifest.tests))
		throw new Error("Invalid tests manifest.");

	const tests = await Promise.all(
		manifest.tests.map((filename) => {
			const url = new URL(filename, TESTS_BASE_URL);
			return loadTest(url);
		})
	);

	return tests;
}

export async function loadTestFromFile(file) {
	const content = await file.text();
	const test = JSON.parse(content);

	return validateTest(test);
}