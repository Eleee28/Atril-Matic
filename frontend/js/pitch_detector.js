let audioContext = null;
let analyser = null;
let isListening = false;
// let animationId = null;
let timerId = null;

// Constants
const FFT_SIZE = 2048;

// Other option, use AudioWorklet or ScriptProcessor to send blocks of audio of fixed size to BE
// instead of reading AnalyserNode, better if the API expects continuous audio samples

async function setupAudioContext() {
	// Setup audio
	audioContext = new (window.AudioContext || window.webkitAudioContext)();
	analyser = audioContext.createAnalyser();
	analyser.fftSize = FFT_SIZE;

	try {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const source = audioContext.createMediaStreamSource(stream);
		source.connect(analyser);
		return true;
	} catch (err) {
		console.error('Error accessing microphone:', err);
		return false;
	}
}

async function detectPitch() {
	if (!isListening || !analyser) return;

	const dataArray = new Uint8Array(analyser.fftSize);
	analyser.getByteTimeDomainData(dataArray);

	try {
		const result = await sendAudioSamples(dataArray);

		// Update UI
		if (result && result.note && result.note !== "None") {
			document.getElementById("pitch-note").textContent = result.note;
			document.getElementById("pitch-freq").textContent = `${result.frequency.toFixed(1)} Hz`;
			document.getElementById("pitch-confidence").textContent = `Confidence: ${(result.confidence * 100).toFixed(0)}%`;
		} else {
			document.getElementById("pitch-note").textContent = "-";
			document.getElementById("pitch-freq").textContent = "0 Hz";
			document.getElementById("pitch-confidence").textContent = "0 %";
		}
	} catch (err) {
		console.error("Error sending audio: ", err);
	}
}

async function toggleListening() {
	const btn = document.getElementById('pitchBtn');
	const status = document.getElementById('pitch-status');

	if (!isListening) {
		// Start listening
		if (!audioContext) {
			const success = await setupAudioContext();
			if (!success) {
				status.textContent = '❌ Failed to access microphone';
				return;
			}
		}

		if (audioContext.state === 'suspended') {
			await audioContext.resume();
		}

		isListening = true;
		btn.textContent = 'Stop Listening';
		status.textContent = '🔴 Listening...';
		startDetection();
	} else {
		// Stop listening
		isListening = false;
		btn.textContent = 'Start Listening';
		status.textContent = '⏸️ Stopped';

		stopDetection();

		document.getElementById("pitch-note").textContent = "-";
			document.getElementById("pitch-freq").textContent = "0 Hz";
			document.getElementById("pitch-confidence").textContent = "0 %";
	}
}

function startDetection() {
	timerId = setInterval(detectPitch, 100); // 10 requests/second
}

function stopDetection() {
	clearInterval(timerId);
	timerId = null;
}

async function sendAudioSamples(samples) {
	const response = await fetch("http://localhost:3000/api/listened-audio", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			samples: Array.from(samples)
		})
	});

	if (!response.ok)
		throw new Error(`Audio request failed: ${response.status}`);

	console.log(response);
	
	const cursors = await response.json(); // peta aqui

	console.log("after response json");
	console.log("cursors: ", cursors);
	
	return cursors;
}

document.getElementById('pitchBtn').addEventListener('click', toggleListening);