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
const scl = 10; // Scale of each grid cell
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

async function setupAudio() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        console.log("Microphone access granted");
    } catch (err) {
        console.error("Microphone access denied", err);
    }
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

// Cube system setup
const cubes = [];

class Cube {
    constructor(size, position, depthFactor) {
        this.size = size; // Size of the cube
        this.position = position; // 3D position (x, y, z)
        this.depthFactor = depthFactor; // Scaling factor for perspective
    }

    update() {
        this.position.z -= 5; // Move the cube closer to the viewer
        if (this.position.z <= 0) {
            this.position.z = Math.random() * 800 + 200; // Reset depth when too close
        }
    }

    draw(ctx) {
        const perspective = 200 / this.position.z; // Perspective scaling
        const screenX = this.position.x * perspective;
        const screenY = this.position.y * perspective;
        const size = this.size * perspective;

        ctx.save();
        ctx.strokeStyle = "rgb(0, 0, 255)"; // Blue stroke only for the cube

        // Draw the cube outline
        ctx.strokeRect(
            canvas.width / 2 + screenX - size / 2,
            canvas.height / 2 + screenY - size / 2,
            size,
            size
        );
        ctx.restore();
    }
}

function spawnCubes() {
    const unitSize = 20; // Base size for cubes
    for (let i = 0; i < 10; i++) { // Adjust number of cubes
        const size = Math.random() * unitSize + unitSize / 2;
        const position = {
            x: Math.random() * canvas.width - canvas.width / 2,
            y: Math.random() * canvas.height - canvas.height / 2,
            z: Math.random() * 1000 + 200 // Depth between 200 and 1200
        };
        const depthFactor = 1; // Optional scaling factor

        let cube = new Cube(size, position, depthFactor);
        cubes.push(cube);
    }
}

function updateCubes() {
    cubes.forEach((cube) => cube.update());
}

function drawCubes() {
    cubes.forEach((cube) => cube.draw(ctx));
}

function drawTerrain() {
    const verticalOffset = canvas.height * 0.2; // Adjust for vertical centering (20% upward shift)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dynamically calculate the center of the canvas
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 - verticalOffset;

    ctx.save(); // Save the current state of the canvas
    ctx.translate(centerX, centerY); // Center the terrain and shift it up
    ctx.scale(1.5, 1.5); // Scale for better visibility on mobile
    ctx.rotate(Math.PI / 2); // Rotate the terrain by 90 degrees

    ctx.strokeStyle = "rgb(0, 255, 0)";

    for (let y = 0; y < rows - 1; y++) {
        ctx.beginPath();
        for (let x = 0; x <= cols; x++) { // Close the loop for the circle
            const adjustedX = x % cols; // Wrap around for seamless connection

            const theta = (adjustedX / cols) * Math.PI * 2; // Circular angle
            const r = ((rows - 1 - y) / rows) * radius; // Radial distance
            const posX = Math.cos(theta) * r;
            const posY = Math.sin(theta) * r;

            if (r < hollowRadius) continue; // Skip the hollow inner radius

            const z = terrain[adjustedX][y]; // Elevation
            ctx.lineTo(posX, posY - z);
        }
        ctx.stroke();
    }
    ctx.restore(); // Restore the canvas state
}


function animate() {
    playerZ += speed; // Move the player forward
    updateTerrain(); // Update the terrain
    updateCubes(); // Update cube positions
    drawTerrain(); // Draw the terrain and cubes
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
spawnCubes();
animate();

// Adjust canvas size for mobile devices
function resizeCanvas() {
    canvas.width = window.innerWidth; // Set to screen width
    canvas.height = window.innerHeight; // Set to screen height
    setupTerrain(); // Reinitialize the terrain with the new dimensions
}

// Listen for window resize events to keep the canvas responsive
window.addEventListener('resize', resizeCanvas);

// Initialize
resizeCanvas();
setupAudio();
setupTerrain();
animate();
