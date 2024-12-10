// Create the canvas and context
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

// Set canvas size to fit the screen
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Simplex Noise implementation
class SimplexNoise {
    constructor() {
        this.grad3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
        this.p = [];
        for (let i = 0; i < 256; i++) this.p[i] = Math.floor(Math.random() * 256);
        this.perm = [];
        for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];
    }

    dot(g, x, y) { return g[0] * x + g[1] * y; }

    noise(xin, yin) {
        let grad3 = this.grad3;
        let perm = this.perm;
        let F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
        let G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

        let s = (xin + yin) * F2;
        let i = Math.floor(xin + s);
        let j = Math.floor(yin + s);
        let t = (i + j) * G2;
        let X0 = i - t;
        let Y0 = j - t;
        let x0 = xin - X0;
        let y0 = yin - Y0;

        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }

        let x1 = x0 - i1 + G2;
        let y1 = y0 - j1 + G2;
        let x2 = x0 - 1.0 + 2.0 * G2;
        let y2 = y0 - 1.0 + 2.0 * G2;

        let ii = i & 255;
        let jj = j & 255;
        let g0 = grad3[perm[ii + perm[jj]] % 12];
        let g1 = grad3[perm[ii + i1 + perm[jj + j1]] % 12];
        let g2 = grad3[perm[ii + 1 + perm[jj + 1]] % 12];

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        let n0 = t0 < 0 ? 0.0 : Math.pow(t0, 4) * this.dot(g0, x0, y0);
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        let n1 = t1 < 0 ? 0.0 : Math.pow(t1, 4) * this.dot(g1, x1, y1);
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        let n2 = t2 < 0 ? 0.0 : Math.pow(t2, 4) * this.dot(g2, x2, y2);

        return 70.0 * (n0 + n1 + n2);
    }
}

const simplex = new SimplexNoise();

// Game setup
const cols = 50; // Number of columns
const rows = 50; // Number of rows
const radius = Math.min(canvas.width, canvas.height) / 3; // Radius of the circle
const hollowRadius = radius / 3; // Radius of the hollow center
let terrain = [];
let flying = 0;
let playerZ = 0; // Player's position in the Z direction
let speed = 2; // Forward speed

// Audio setup
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
const frequencyData = new Uint8Array(analyser.frequencyBinCount);
let audioSource = null;

async function setupAudio() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioSource = audioContext.createMediaStreamSource(stream);
        const gainNode = audioContext.createGain(); // Create a gain node to control volume

        // Connect the audio source to the analyser
        audioSource.connect(analyser);

        // Connect the analyser to the gain node
        analyser.connect(gainNode);

        // Connect the gain node to the audio context's destination (speakers)
        gainNode.connect(audioContext.destination);

        console.log("Microphone access granted and audio connected to speakers");

        // Test the audio output
        testAudioOutput();
    } catch (err) {
        console.error("Microphone access denied", err);
    }
}

// Function to test speaker output with a simple sound
function testAudioOutput() {
    const oscillator = audioContext.createOscillator();
    oscillator.type = "sine"; // Sine wave
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
    oscillator.connect(audioContext.destination);

    // Start the oscillator for a brief period
    oscillator.start();
    setTimeout(() => {
        oscillator.stop();
        console.log("Audio test complete");
    }, 1000);
}

function updateAudioData() {
    analyser.getByteFrequencyData(frequencyData);
}

function setupTerrain() {
    for (let x = 0; x < cols; x++) {
        terrain[x] = [];
        for (let y = 0; y < rows; y++) {
            terrain[x][y] = 0; // Initialize terrain
        }
    }
}

function updateTerrain() {
    flying += 0.01; // Reverse animation to move outward
    let yoff = flying;
    updateAudioData(); // Get the latest audio frequency data
    const maxFreqIndex = Math.min(frequencyData.length, cols); // Map frequency data to the number of columns
    for (let y = rows - 1; y >= 0; y--) { // Reverse row iteration for outward expansion
        let xoff = 0;
        for (let x = 0; x < cols; x++) {
            const audioHeight = frequencyData[x % maxFreqIndex] / 255 * 50; // Map audio frequency to height
            terrain[x][y] = simplex.noise(xoff, yoff + playerZ / 100) * 20 + audioHeight; // Add audio height to terrain
            xoff += 0.2; // Smooth noise
        }
        yoff += 0.2;
    }
}

function drawTerrain() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 1.5, canvas.height / 1.5); // Center the view
    ctx.scale(1.5, 1.5); // Zoom in the camera for better mobile visibility
    ctx.rotate(Math.PI / 2); // Rotate the terrain 90 degrees

    ctx.strokeStyle = "rgb(0, 255, 0)";

    for (let y = 0; y < rows - 1; y++) {
        ctx.beginPath();
        for (let x = 0; x <= cols; x++) { // Adjusted loop to close the circle
            const adjustedX = x % cols; // Wrap around for the last connection

            const theta = (adjustedX / cols) * Math.PI * 2; // Angle around circle
            const r = ((rows - 1 - y) / rows) * radius; // Reverse radial distance for outward expansion
            const posX = Math.cos(theta) * r;
            const posY = Math.sin(theta) * r;

            if (r < hollowRadius) continue; // Skip inner radius

            const z = terrain[adjustedX][y]; // Elevation value
            ctx.lineTo(posX, posY - z);
        }
        ctx.stroke();
    }
    ctx.resetTransform(); // Reset transformations
}

function animate() {
    playerZ += speed; // Move the player forward
    updateTerrain(); // Update the terrain
    drawTerrain(); // Draw the terrain
    requestAnimationFrame(animate);
}

// Mobile tap-based movement
canvas.addEventListener("touchstart", () => {
    speed += 1; // Increase speed on tap
});

canvas.addEventListener("touchend", () => {
    speed = Math.max(1, speed - 1); // Decrease speed when tap ends
});

// Initialize the audio setup
setupAudio();

// Initialize the terrain and start the animation
setupTerrain();
animate();

// Adjust canvas size for mobile devices
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    setupTerrain(); // Reinitialize terrain for new dimensions
});
