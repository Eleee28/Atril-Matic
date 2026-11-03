import { initializeConfig, getConfig, validateConfig, handleConfigChange } from "./config.js";
import { runTest, TestStatus } from "./test-runner.js";
import { METRICS, getNoteResults, computeMetrics, compareMetric, formatMetric, formatMetricDelta } from "./metrics.js";

const CONFIG_INDEXES = [1, 2];

const forms = new Map();
const comparisons = new Map();

function getStorageKey(index) {
	return `atril-matic-testing-compare-config-${index}`;
}

function createConfigForm(index) {
	const form = document.getElementById("configuration-form").cloneNode(true);
	const prefix = `compare-${index}-`;

	form.id = `compare-form-${index}`;

	form.querySelectorAll("[id]").forEach((element) => {
		element.id = prefix + element.id;
	});

	form.querySelectorAll("label[for]").forEach((label) => {
		label.htmlFor = prefix + label.htmlFor;
	});

	return form;
}

function copyConfig(sourceIndex, targetIndex) {
	const source = forms.get(sourceIndex);
	const target = forms.get(targetIndex);

	for (const element of source.elements) {
		if (!element.name)
			continue;
		
		const targetElement = target.elements.namedItem(element.name);
		if (targetElement)
			targetElement.value = element.value;
	}

	handleConfigChange(target, getStorageKey(targetIndex));
}

export function initializeCompare() {
	for (const index of CONFIG_INDEXES) {
		const form = createConfigForm(index);

		document.getElementById(`compare-config-${index}`).appendChild(form);
		forms.set(index, form);

		initializeConfig(form, getStorageKey(index));
	}

	document.querySelectorAll(".copy-config-button").forEach((button) => {
		button.addEventListener("click", () => {
			copyConfig(Number(button.dataset.source), Number(button.dataset.target));
		});
	});

	document.getElementById("compare-clear-results-button").addEventListener("click", clearComparisons);
}

function getValidatedConfigs() {
	const configs = new Map();

	for (const index of CONFIG_INDEXES) {
		const config = getConfig(forms.get(index));
		const errors = validateConfig(config);

		if (errors.length > 0)
			throw new Error(`Config ${index}:\n${errors.join("\n")}`);

		configs.set(index, config);
	}

	return configs;
}

async function runComparison(test, configs) {
	const comparison = {
		id: test.id,
		name: test.name,
		runs: new Map(CONFIG_INDEXES.map(index => [index, null])),
	};

	comparisons.set(test.id, comparison);
	render();

	for (const index of CONFIG_INDEXES) {
		await runTest(test, configs.get(index), (result) => {
			comparison.runs.set(index, result);
			render();
		});
	}
}

export async function runCompareTest(test) {
	await runComparison(test, getValidatedConfigs());
}

export async function runCompareAll(tests) {
	const configs = getValidatedConfigs();
	
	for (const test of tests) {
		await runComparison(test, configs);
	}
}

function clearComparisons() {
	comparisons.clear();
	render();
}

function isFinished(result) {
	return result != null && result.status !== TestStatus.PENDING && result.status !== TestStatus.RUNNING;
}

function render() {
	renderSummary();
	renderResults();
}

function getOverallMetrics(entries) {
	return new Map(CONFIG_INDEXES.map((index) => [
		index,
		computeMetrics(entries.flatMap(entry => getNoteResults(entry.runs.get(index))))
	]));
}

function getFinishedComparisons() {
	return [...comparisons.values()].filter(
		entry => CONFIG_INDEXES.every(index => isFinished(entry.runs.get(index)))
	);
}

function renderSummary() {
	const finished = getFinishedComparisons();
	const runs = finished.flatMap(entry => [...entry.runs.values()]);

	const countPassed = index => finished.filter(
		entry => entry.runs.get(index).status === TestStatus.PASS
	).length;

	document.getElementById("compare-total-tests").textContent = finished.length;
	document.getElementById("compare-passed-1").textContent = countPassed(1);
	document.getElementById("compare-passed-2").textContent = countPassed(2);
	document.getElementById("compare-error-tests").textContent = runs.filter(
		result => result.status === TestStatus.ERROR
	).length;

	const overall = getOverallMetrics(finished);
	const f1Metric = METRICS.find(metric => metric.key === "f1");
	const better = document.getElementById("compare-better-config");

	if (!overall.get(1) || !overall.get(2)) {
		better.textContent = "-";
		return;
	}

	const winner = compareMetric(f1Metric, overall.get(1).f1, overall.get(2).f1);
	better.textContent = winner === 0 ? "Tie" : `Config ${winner}`;
}

function renderResults() {
	const container = document.getElementById("compare-results-list");

	container.replaceChildren();

	if (comparisons.size === 0) {
		const empty = document.createElement("p");
		empty.className = "empty-state";
		empty.textContent = "Run a test to compare both configurations";

		container.appendChild(empty);
		return;
	}

	const finished = getFinishedComparisons();
	const overall = getOverallMetrics(finished);

	if (overall.get(1) || overall.get(2))
		container.appendChild(createOverallElement(finished.length, overall));

	for (const comparison of comparisons.values())
		container.appendChild(createComparisonElement(comparison));
}

function createOverallElement(testCount, overall) {
	const item = document.createElement("div");
	item.className = "result-item overall-item";

	const header = document.createElement("div");
	header.className = "result-header";

	const name = document.createElement("span");
	name.className = "result-name";
	name.textContent = "Overall";

	const count = document.createElement("span");
	count.className = "result-meta";
	const notes = overall.get(1)?.total ?? overall.get(2)?.total ?? 0;
	count.textContent = `${testCount} test${testCount === 1 ? "" : "s"}, ${notes} notes`;

	header.append(name, count);

	const details = document.createElement("div");
	details.className = "result-details";
	details.appendChild(createMetricsTable(overall.get(1), overall.get(2)));

	item.append(header, details);

	return item;
}

function createStatusBadge(index, result) {
	const status = result?.status ?? TestStatus.PENDING;

	const badge = document.createElement("span");
	badge.className = `status status-${status}`;
	badge.textContent = `C${index} ${status}`;

	return badge;
}

function createComparisonElement(comparison) {
	const item = document.createElement("div");
	item.className = "result-item";

	const header = document.createElement("div");
	header.className = "result-header";

	const name = document.createElement("span");
	name.className = "result-name";
	name.textContent = comparison.name;

	const statuses = document.createElement("div");
	statuses.className = "result-statuses";

	for (const index of CONFIG_INDEXES)
		statuses.appendChild(createStatusBadge(index, comparison.runs.get(index)));

	header.append(name, statuses);

	const details = document.createElement("div");
	details.className = "result-details";

	for (const index of CONFIG_INDEXES) {
		const result = comparison.runs.get(index);

		if (!isFinished(result))
			continue;

		const line = document.createElement("p");
		const summary = result.actual?.total !== undefined
			? `, ${result.actual.passed}/${result.actual.total} notes recognized correctly`
			: "";
		line.textContent = `Config ${index}: ${result.durationMs.toFixed(1)} ms${summary}`;
		details.appendChild(line);

		if (result.error) {
			const error = document.createElement("p");
			error.className = "result-error";
			error.textContent = `Config ${index} error: ${result.error}`;
			details.appendChild(error);
		}
	}

	const results1 = comparison.runs.get(1);
	const results2 = comparison.runs.get(2);
	const metrics1 = isFinished(results1) ? computeMetrics(getNoteResults(results1)) : null;
	const metrics2 = isFinished(results2) ? computeMetrics(getNoteResults(results2)) : null;

	if (metrics1 || metrics2)
		details.appendChild(createMetricsTable(metrics1, metrics2));

	if (metrics1 && metrics2)
		details.appendChild(createDifferencesElement(getNoteResults(results1), getNoteResults(results2)));

	item.append(header, details);

	return item;
}

function createTable(titles) {
	const table = document.createElement("table");
	table.className = "results-table";

	const thead = document.createElement("thead");
	const headerRow = document.createElement("tr");

	for (const title of titles) {
		const th = document.createElement("th");
		th.textContent = title;
		headerRow.appendChild(th);
	}

	thead.appendChild(headerRow);

	const tbody = document.createElement("tbody");

	table.append(thead, tbody);

	return { table, tbody };
}

function createCell(text, className) {
	const cell = document.createElement("td");
	cell.textContent = text;

	if (className)
		cell.className = className;
	return cell;
}

function createMetricsTable(metrics1, metrics2) {
	const { table, tbody } = createTable(["Metric", "Config 1", "Config 2", "Δ (C2 - C1)"]);
	table.classList.add("metrics-table");

	for (const metric of METRICS) {
		const value1 = metrics1?.[metric.key];
		const value2 = metrics2?.[metric.key];
		const winner = compareMetric(metric, value1, value2);

		const row = document.createElement("tr");

		const label = createCell(metric.label, "metric-label");
		label.title = metric.description;
		
		row.append(
			label,
			createCell(formatMetric(metric, value1), winner === 1 ? "metric-winner" : ""),
			createCell(formatMetric(metric, value2), winner === 2 ? "metric-winner" : ""),
			createCell(formatMetricDelta(metric, value1, value2), "metric-delta"),
		);

		tbody.appendChild(row);
	}

	return table;
}

function formatCents(item) {
	return Number.isFinite(item?.errorCents) ? item.errorCents.toFixed(2) : "-";
}

function formatAccuracy(item) {
	return Number.isFinite(item?.accuracy) ? `${(item.accuracy * 100).toFixed(1)}%` : "-";
}

function getDetectedClass(item) {
	return item?.actual === item?.expected ? "note-correct" : "note-wrong";
}

function createDifferencesElement(notes1, notes2) {
	const length = Math.max(notes1.length, notes2.length);
	const differences = [];

	for (let i = 0; i < length; i++) {
		if (notes1[i]?.actual !== notes2[i]?.actual)
			differences.push([notes1[i], notes2[i]]);
	}

	if (differences.length === 0) {
		const same = document.createElement("p");
		same.textContent = "Both configurations detected the same notes.";
		return same;
	}

	const container = document.createElement("details");
	container.className = "collapsible";

	const summary = document.createElement("summary");
	summary.textContent = `Per-note differences (${differences.length})`;

	const { table, tbody } = createTable([
		"Input Frequency",
		"Expected Note",
		"C1 Detected",
		"C1 Error (Cents)",
		"C1 Accuracy",
		"C2 Detected",
		"C2 Error (Cents)",
		"C2 Accuracy",
	]);

	for (const [item1, item2] of differences) {
		const reference = item1 ?? item2;
		const row = document.createElement("tr");

		row.append(
			createCell(`${reference.frequency.toFixed(2)} Hz`),
			createCell(reference.expected),
			createCell(item1?.actual ?? "-", getDetectedClass(item1)),
			createCell(formatCents(item1)),
			createCell(formatAccuracy(item1)),
			createCell(item2?.actual ?? "-", getDetectedClass(item2)),
			createCell(formatCents(item2)),
			createCell(formatAccuracy(item2)),
		);

		tbody.appendChild(row);
	}

	const wrapper = document.createElement("div");
	wrapper.className = "table-scroll";
	wrapper.appendChild(table);

	container.append(summary, wrapper);

	return container;
}