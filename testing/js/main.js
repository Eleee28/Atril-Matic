import { initializeConfig, getConfig, validateConfig } from "./config.js";
import { loadPredefinedTests, loadTestFromFile } from "./test-loader.js";
import { runTest, runAllTests } from "./test-runner.js";
import { updateResult, clearResults } from "./results.js";

let tests = [];
let isRunning = false;

async function initializeApp() {
	initializeConfig();

	document.getElementById("run-all-button").addEventListener("click", executeAllTests);

	document.getElementById("load-test-button").addEventListener("click", () => {
		document.getElementById("test-file-input").click();
	});

	document.getElementById("test-file-input").addEventListener("change", handleTestFile);

	document.getElementById("clear-results-button").addEventListener("click", clearResults);

	try {
		tests = await loadPredefinedTests();
		renderTests();

		console.log("Atril-Matic Testing initialized");
		console.log("Current configuration: ", getConfig());
	} catch (error) {
		console.error("Failed to initialize tests: ", error);
		alert(`Failed to load predefined tests: ${error.message}`);
	}
}

function getValidatedConfig() {
	const config = getConfig();
	const errors = validateConfig(config);

	if (errors.length > 0)
		throw new Error(errors.join("\n"));

	return config;
}

function getTestConfig(test) {
	const currentConfig = getValidatedConfig();

	const override = document.getElementById("use-current-config").checked;

	if (override || !test.config)
		return currentConfig;

	const config = {
		...currentConfig,
		...test.config,
	};

	const errors = validateConfig(config);
	if (errors.length > 0)
		throw new Error(errors.join("\n"));

	return config;
}

function renderTests() {
	const container = document.getElementById("tests-list");

	container.replaceChildren();

	if (tests.length === 0) {
		const empty = document.createElement("p");
		empty.className = "empty-state";
		empty.textContent = "No tests loaded.";

		container.appendChild(empty);
		return;
	}

	for (const test of tests) {
		container.appendChild(createTestElement(test));
	}
}

function createTestElement(test) {
	const item = document.createElement("div");
	item.className = "test-item";

	const info = document.createElement("div");
	info.className = "test-info";

	const name = document.createElement("h3");
	name.className = "test-name";
	name.textContent = test.name;

	const description = document.createElement("p");
	description.className = "test-description";
	description.textContent = test.description ?? "";

	info.append(name, description);

	const button = document.createElement("button");
	button.type = "button";
	button.textContent = "Run";

	button.addEventListener("click", () => {
		executeSingleTest(test);
	});

	item.append(info, button);

	return item;
}

async function executeSingleTest(test) {
	if (isRunning)
		return;

	isRunning = true;
	setRunningState(true);

	try {
		const config = getTestConfig(test);
		await runTest(test, config, updateResult);
	} catch (error) {
		alert(error.message);
	} finally {
		isRunning = false;
		setRunningState(false);
	}
}

async function executeAllTests() {
	if (isRunning)
		return;

	isRunning = true;
	setRunningState(true);

	try {
		const currentConfig = getValidatedConfig();

		const override = document.getElementById("use-current-config").checked;

		if (override) {
			await runAllTests(tests, currentConfig, updateResult);
		} else {
			for (const test of tests) {
				const config = getTestConfig(test);

				await runTest(test, config, updateResult);
			}
		}
	} catch (error) {
		alert(error.message);
	} finally {
		isRunning = false;
		setRunningState(false);
	}
}

function setRunningState(running) {
	document.getElementById("run-all-button").disabled = running;

	document.querySelectorAll(".test-item button").forEach(
		(button) => {
			button.disabled = running;
		}
	);
}

async function handleTestFile(event) {
	const file = event.target.files[0];

	if (!file)
		return;

	try {
		const test = await loadTestFromFile(file);

		const existingIndex = tests.findIndex(
			(item) => item.id === test.id
		);

		if (existingIndex >= 0)
			tests[existingIndex] = test;
		else
			tests.push(test);

		renderTests();
	} catch (error) {
		alert(`Failed to load test: ${error.message}`);
	} finally {
		event.target.value = "";
	}
}

document.addEventListener("DOMContentLoaded", initializeApp);