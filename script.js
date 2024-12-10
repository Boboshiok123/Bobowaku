// Create the canvas and context for visualization
const canvas = document.getElementById('visualization');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Initialize WebSocket to communicate with Node.js
const socket = new WebSocket("ws://localhost:8080");

// Web Audio API setup for capturing microphone input and playback
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let micStream = null; // Microphone input stream
let scriptNode = null; // ScriptProcessorNode for real-time processing
const audioBufferQueue = []; // Queue for received audio from Node.js

// Function to initialize microphone input
async function initMic() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStream = audioCtx.createMediaStreamSource(stream);

        // Create a ScriptProcessorNode to capture microphone data
        const micProcessor = audioCtx.createScriptProcessor(2048, 1, 1);
        micStream.connect(micProcessor);
        micProcessor.connect(audioCtx.destination);

        // Send audio data to Node.js server
        micProcessor.onaudioprocess = (event) => {
            const inputData = event.inputBuffer.getChannelData(0);
            const audioData = new Float32Array(inputData.length);
            audioData.set(inputData);

            if (socket.readyState === WebSocket.OPEN) {
                socket.send(audioData.buffer); // Send raw audio data to Node.js
            }
        };

        console.log("Microphone initialized and audio data being sent to Node.js.");
    } catch (err) {
        console.error("Error accessing microphone:", err);
    }
}

// Create a ScriptProcessorNode for playback of audio received from Node.js
function initPlayback() {
    scriptNode = audioCtx.createScriptProcessor(2048, 1, 1);

    scriptNode.onaudioprocess = (event) => {
        const outputBuffer = event.outputBuffer.getChannelData(0);

        if (audioBufferQueue.length > 0) {
            const audioBuffer = audioBufferQueue.shift();
            outputBuffer.set(audioBuffer); // Fill output buffer with audio data
        } else {
            outputBuffer.fill(0); // Fill with silence if no data is available
        }
    };

    scriptNode.connect(audioCtx.destination);
}

// Handle incoming WebSocket messages (audio data from Pure Data)
socket.onmessage = (event) => {
    const incomingData = new Float32Array(event.data);
    audioBufferQueue.push(incomingData); // Add received audio to the playback queue
};

// Log WebSocket connection status
socket.onopen = () => {
    console.log("WebSocket connection established.");
};

socket.onclose = () => {
    console.log("WebSocket connection closed.");
};

socket.onerror = (error) => {
    console.error("WebSocket error:", error);
};

// Play audio and visualization upon user interaction
document.addEventListener("click", () => {
    if (audioCtx.state === "suspended") {
        audioCtx.resume(); // Resume audio context
    }
    if (!micStream) {
        initMic(); // Initialize microphone input
    }
    if (!scriptNode) {
        initPlayback(); // Initialize playback system
    }
});

// Basic visualization setup (optional)
function drawVisualization() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.fillText("Audio Reactive Visualization Running...", canvas.width / 2 - 150, canvas.height / 2);

    requestAnimationFrame(drawVisualization);
}

// Initialize visualization
drawVisualization();

// Adjust canvas size on window resize
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
