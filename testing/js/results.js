const results = new Map();

export function updateResult(result) {
	results.set(result.id, result);

	renderResults();
	renderSummary();
}

export function clearResults() {
	results.clear();

	renderResults();
	renderSummary();
}

function renderSummary() {
	const completed = [...results.values()].filter(
		(result) => result.status !== "pending" && 
					result.status !== "running"
	);

	const passed = completed.filter(
		(result) => result.status === "pass"
	).length;

	const failed = completed.filter(
		(result) => result.status === "fail"
	).length;

	const errors = completed.filter(
		(result) => result.status === "error"
	).length;

	const duration = completed.reduce(
		(total, result) => total + result.durationMs, 0
	);

	document.getElementById("total-tests").textContent = completed.length;
	document.getElementById("passed-tests").textContent = passed;
	document.getElementById("failed-tests").textContent = failed;
	document.getElementById("error-tests").textContent = errors;
	document.getElementById("tests-duration").textContent = `${duration.toFixed(1)} ms`;
}

function renderResults() {
	const container = document.getElementById("results-list");

	container.replaceChildren();

	if (results.size === 0) {
		const empty = document.createElement("p");
		empty.className = "empty-state";
		empty.textContent = "Run a test to see results.";

		container.appendChild(empty);
		return;
	}

	for (const result of results.values()) {
		container.appendChild(createResultElement(result));
	}
}

function createResultElement(result) {
	const item = document.createElement("div");
	item.className = "result-item";

	const header = document.createElement("div");
	header.className = "result-header";

	const name = document.createElement("span");
	name.className = "result-name";
	name.textContent = result.name;

	const status = document.createElement("span");
	status.className = `status status-${result.status}`;
	status.textContent = result.status.toUpperCase();

	header.append(name, status);

	const details = document.createElement("div");
	details.className = "result-details";

	const duration = document.createElement("p");
	duration.textContent = `Duration: ${result.durationMs.toFixed(1)} ms`;

	details.appendChild(duration);

	if (result.error) {
		const error = document.createElement("p");
		error.textContent = `Error: ${result.error}`;
		details.appendChild(error);
	}

	if (result.type === "pitch-detection" && result.actual?.results) {
		const failedResults = result.actual.results.filter(
			item => !item.passed || item.accuracy < 0.95
		);

		const summary = document.createElement("p");
		summary.textContent = `${result.actual.passed}/${result.actual.total} notes recognized correctly`;

		details.appendChild(summary);

		if (failedResults.length > 0) {
			const table = document.createElement("table");
			table.className = "results-table";

			const thead = document.createElement("thead");
			const headerRow = document.createElement("tr");

			for (const title of ["Input Frequency", "Detected Frequency", "Error(cents)", "Expected Note", "Detected Note", "Accuracy"]) {
				const th = document.createElement("th");
				th.textContent = title;
				headerRow.appendChild(th);
			}

			thead.appendChild(headerRow);
			table.appendChild(thead);

			const tbody = document.createElement("tbody");

			for (const item of failedResults) {
				const row = document.createElement("tr");

				console.log("result item: ", item);

				const values = [
					`${item.frequency.toFixed(2)} Hz`,

					item.detectedFrequency !== null
						? `${item.detectedFrequency.toFixed(2)} Hz`
						: "-",

					item.errorCents !== null
						? item.errorCents.toFixed(2)
						: "-",
					
					item.expected,
					item.actual ?? "-",
					`${(item.accuracy * 100).toFixed(1)}%`,
				];

				for (const value of values) {
					const cell = document.createElement("td");
					cell.textContent = value;
					row.appendChild(cell);
				}

				tbody.appendChild(row);
			}

			table.appendChild(tbody);
			details.appendChild(table);
		}
	}

	else if (result.actual !== null) {
		const expected = document.createElement("pre");
		expected.textContent = `Expected: \n${JSON.stringify(result.expected, null, 2)}`;

		const actual = document.createElement("pre");
		actual.textContent = `Actual: \n${JSON.stringify(result.actual, null, 2)}`;

		details.append(expected, actual);
	}

	item.append(header, details);

	return item;
}