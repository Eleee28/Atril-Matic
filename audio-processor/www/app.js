 import init, { AudioProcessor } from '../pkg/audio_processor_node_prototype.js';

        let detector = null;
        let audioContext = null;
        let analyser = null;
        let isListening = false;
        let animationId = null;

        // Constants
        const FFT_SIZE = 2048;
        const SAMPLE_RATE = 10000;

        async function setup() {
            await init();
            detector = AudioProcessor.new(SAMPLE_RATE, FFT_SIZE);

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

        function detectPitch() {
            if (!isListening || !analyser || !detector) return;

            const dataArray = new Uint8Array(analyser.fftSize);
            analyser.getByteTimeDomainData(dataArray);

            // Detect pitch
            const result = JSON.parse(detector.detect_pitch(dataArray));

            // Update UI
            if (result && result.note && result.note !== "None") {
                document.getElementById('note').textContent = result.note;
                document.getElementById('frequency').textContent = `${result.frequency.toFixed(1)} Hz`;
                document.getElementById('confidence').textContent = `Confidence: ${(result.confidence * 100).toFixed(0)}%`;
            } else {
                document.getElementById('note').textContent = '🎤';
                document.getElementById('frequency').textContent = 'Listening...';
                document.getElementById('confidence').textContent = 'Confidence: 0%';
            }

            // Continue detection loop
            animationId = requestAnimationFrame(detectPitch);
        }

        async function toggleListening() {
            const btn = document.getElementById('toggleBtn');
            const status = document.getElementById('status');

            if (!isListening) {
                // Start listening
                if (!audioContext) {
                    const success = await setup();
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
                detectPitch();
            } else {
                // Stop listening
                isListening = false;
                btn.textContent = 'Start Listening';
                status.textContent = '⏸️ Stopped';

                if (animationId) {
                    cancelAnimationFrame(animationId);
                    animationId = null;
                }

                document.getElementById('note').textContent = '-';
                document.getElementById('frequency').textContent = '0 Hz';
                document.getElementById('confidence').textContent = 'Confidence: 0%';
            }
        }

        document.getElementById('toggleBtn').addEventListener('click', toggleListening);
