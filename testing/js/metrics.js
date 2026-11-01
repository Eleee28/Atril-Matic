export const METRICS = [
	{
		key: "noteAccuracy",
		label: "Note Accuracy",
		description: "Notes whose most frequent detected note matches the expected note.",
		format: "percent",
		higherIsBetter: true,
	},
	{
		key: "windowAccuracy",
		label: "Window Accuracy",
		description: "Analysis windows that detected the expected note.",
		format: "percent",
		higherIsBetter: true,
	},
	{
		key: "precision",
		label: "Precision",
		description: "Per expected note: correct detections / times that note was detected. Averaged over notes.",
		format: "percent",
		higherIsBetter: true,
	},
	{
		key: "recall",
		label: "Recall",
		description: "Per expected note: correct detections / times that note was expected. Averaged over notes.",
		format: "percent",
		higherIsBetter: true,
	},
	{
		key: "f1",
		label: "F1 Score",
		description: "Harmonic mean of precision and recall per expected note. Averaged over notes.",
		format: "percent",
		higherIsBetter: true,
	},
	{
		key: "detectionRate",
		label: "Detection Rate",
		description: "Notes where any pitch was detected, right or wrong.",
		format: "percent",
		higherIsBetter: true,
	},
	{
		key: "meanAbsCents",
		label: "Mean |Error| (Cents)",
		description: "Mean absolute pitch error of detected notes, in cents.",
		format: "cents",
		higherIsBetter: false,
	},
	{
		key: "medianAbsCents",
		label: "Median |Error| (Cents)",
		description: "Median absolute pitch error of detected notes, in cents.",
		format: "cents",
		higherIsBetter: false,
	},
	{
		key: "within10Cents",
		label: "Within ±10 cents",
		description: "Notes detected with an error of at most 10 cents. Undetected notes count as outside.",
		format: "percent",
		higherIsBetter: true,
	},
	{
		key: "within50Cents",
		label: "Within ±50 cents",
		description: "Notes detected with an error of at most 50 cents. Undetected notes count as outside.",
		format: "percent",
		higherIsBetter: true,
	},
	{
		key: "octaveErrorRate",
		label: "Octave Error Rate",
		description: "Notes detected with the right pitch class but the wrong octave.",
		format: "percent",
		higherIsBetter: false,
	},
];

export function getNoteResults(result) {
	if (result?.type !== "pitch-detection" || !Array.isArray(result.actual?.results))
		return [];
	return result.actual.results;
}

export function computeMetrics(noteResults) {
	const total = noteResults.length;

	if (total === 0)
		return null;

	const correct = noteResults.filter(item => item.actual === item.expected).length;
	const detected = noteResults.filter(item => item.actual !==  null).length;

	const totalWindows = sum(noteResults.map(item => item.totalWindows ?? 0));
	const correctWindows = sum(noteResults.map(item => item.correctWindows ?? 0));

	const absCents = noteResults
		.filter(item => Number.isFinite(item.errorCents))
		.map(item => Math.abs(item.errorCents));

	const octaveErrors = noteResults.filter(item =>
		item.actual !== null && item.actual !== item.expected &&
		getPitchClass(item.actual) === getPitchClass(item.expected)
	).length;

	return {
		total,
		noteAccuracy: correct / total,
		windowAccuracy: totalWindows > 0 ? correctWindows / totalWindows : null,
		...computeScores(noteResults),
		detectionRate: detected / total,
		meanAbsCents: absCents.length > 0 ? sum(absCents) / absCents.length : null,
		medianAbsCents: getMedian(absCents),
		within10Cents: absCents.filter(value => value <= 10).length / total,
		within50Cents: absCents.filter(value => value <= 50).length / total,
		octaveErrorRate: octaveErrors / total,
	};
}

// Precision and recall are averaged over the expected note classes
// A class that is never predicted gets precision 0
function computeScores(noteResults) {
	const classes = [...new Set(noteResults.map(item => item.expected))];

	const scores = classes.map((note) => {
		const truePositives = noteResults.filter(item => item.expected === note && item.actual === note).length;
		const predicted = noteResults.filter(item => item.actual === note).length;
		const expected = noteResults.filter(item => item.expected === note).length;

		const precision = predicted > 0 ? truePositives / predicted : 0;
		const recall = expected > 0 ? truePositives / expected : 0;
		const f1 = predicted + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

		return ({ precision, recall, f1});
	})

	return {
		precision: average(scores.map(score => score.precision)),
		recall: average(scores.map(score => score.recall)),
		f1: average(scores.map(score => score.f1)),
	};
}

export function compareMetric(matric, value1, value2) {
	if (!Number.isFinite(value1) || !Number.isFinite(value2))
		return 0;

	if (Math.abs(value1 - value2) < 1e-9)
		return 0;

	const firstIsBetter = metric.higherIsBetter ? value1 > value2 : value1 < value2;

	return firstIsBetter ? 1 : 2;
}

export function formatMetric(metric, value) {
	if (!Number.isFinite(value))
		return "-";

	if (metric.format === "percent")
		return `${(value * 100).toFixed(1)}%`;

	return value.toFixed(2);
}

export function formatMetricDelta(metric, value1, value2) {
	if (!Number.isFinite(value1) || !Number.isFinite(value2))
		return "-";

	const delta = value2 - value1;
	const sign = delta > 0 ? "+" : "-"; 

	if (metric.format === "percent")
		return `${sign}${(delta * 100).toFixed(1)}pp`;

	return `${sign}${delta.toFixed(2)}`;
}

function getPitchClass(note) {
	return typeof note === "string" ? note.replace(/-?\d+$/, "") : null; // regex matches 1 optional -, a digit repeated at least once, end of string ($)
}

function sum(values) {
	return values.reduce((total, value) => total + value, 0);
}

function average(values) {
	return values.length > 0 ? sum(values) / values.length : null;
}

export function getMedian(values) {
	if (values.length === 0)
		return null;

	const sorted = [...values].sort((a, b) => a - b);

	const middle = Math.floor(sorted.length / 2);

	if (sorted.length % 2 === 0)
		return (sorted[middle - 1] + sorted[middle]) / 2;

	return sorted[middle];
}