import { executeTest } from "./wasm-adapter.js";

export const TestStatus = Object.freeze({
	PENDING: "pending",
	RUNNING: "running",
	PASS: "pass",
	FAIL: "fail",
	ERROR: "error",
});

export async function runTest(test, config, onUpdate = () => {}) {
	const result = {
		id: test.id,
		name: test.name,
		type: test.type,
		status: TestStatus.RUNNING,
		durationMs: 0,
		expected: test.expected, 
		actual: null,
		error: null,
	};

	onUpdate({ ...result });

	const startTime = performance.now();

	try {
		const actual = await executeTest(test, config);

		result.actual = actual;
		result.status = compareResults(test, actual) ? TestStatus.PASS : TestStatus.FAIL;
	} catch (error) {
		result.status = TestStatus.ERROR;
		result.error = error.message;
	}

	result.durationMs = performance.now() - startTime;

	onUpdate({ ...result });

	return result;
}

export async function runAllTests(tests, config, onUpdate = () => {}) {
	const results = [];

	for (const test of tests) {
		const result = await runTest(test, config, onUpdate);
		results.push(result);
	}

	return results;
}

function compareResults(test, actual) {
	switch (test.type) {
		case "pitch-detection":
			return (
				actual.total === test.input.frequencies.length && 
				actual.failed === 0
			);

			// If we want al least 95% of the windows of each frequency to be recognized correctly
			return (
				actual.total === test.input.frequencies.length &&
				actual.results.every(
					result =>
						result.passed && 
						result.accuracy >= (test.expected.minAccuracy ?? 0.95)
				)
			);

		case "audio-recognition":
			return compareNotes(actual.notes, test.expected.notes);
		
		case "score-tracking":
			return compareCursor(actual, test.expected);
		
		default:
			return false;
	}
}

function compareNotes(actual, expected) {
	if (!Array.isArray(actual) || !Array.isArray(expected))
		return false;

	if (actual.length !== expected.length())
		return false;

	return expected.every((note, index) => {
		const detected = actual[index];

		return (
			detected.note === note.note &&
			detected.start === note.start &&
			detected.end === note.end
		);
	});
}

function compareCursor(actual, expected) {
	if (!Number.isFinite(actual.finalCursorTimestampMs))
		return false;

	const tolerance = expected.toleranceMs ?? 0;

	return Math.abs(
		actual.finalCursorTimestampMs - expected.finalCursorTimestampMs
	) <= tolerance;
}