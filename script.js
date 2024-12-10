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

    dot(g, x, y) {
        return g[0] * x + g[1] * y;
    }

    noise(xin, yin) {
        const grad3 = this.grad3;
        const perm = this.perm;
        const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
        const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = xin - X0;
        const y0 = yin - Y0;

        const i1 = x0 > y0 ? 1 : 0;
        const j1 = x0 > y0 ? 0 : 1;

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2;
        const y2 = y0 - 1.0 + 2.0 * G2;

        const ii = i & 255;
        const jj = j & 255;
        const g0 = grad3[perm[ii + perm[jj]] % 12];
        const g1 = grad3[perm[ii + i1 + perm[jj + j1]] % 12];
        const g2 = grad3[perm[ii + 1 + perm[jj + 1]] % 12];

        const t0 = 0.5 - x0 * x0 - y0 * y0;
        const n0 = t0 < 0 ? 0.0 : Math.pow(t0, 4) * this.dot(g0, x0, y0);
        const t1 = 0.5 - x1 * x1 - y1 * y1;
        const n1 = t1 < 0 ? 0.0 : Math.pow(t1, 4) * this.dot(g1, x1, y1);
        const t2 = 0.5 - x2 * x2 - y2 * y2;
        const n2 = t2 < 0 ? 0.0 : Math.pow(t2, 4) * this.dot(g2, x2, y2);

        return 70.0 * (n0 + n1 + n2);
    }
}

const simplex = new SimplexNoise();

// Game setup
const cols = 50;
const rows = 50;
const radius = Math.min(canvas.width, canvas.height) / 3;
const hollowRadius = radius / 3;
let terrain = [];
let flying = 0;
let playerZ = 0;
let speed = 2;

// Audio setup
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
const frequencyData = new Uint8Array(analyser.frequencyBinCount);

async function setupMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const micSource = audioContext.createMediaStreamSource(stream);

        // Only connect microphone to analyser, not to speakers
        micSource.connect(analyser);

        console.log("Microphone connected");
    } catch (err) {
        console.error("Microphone access denied", err);
    }
}

async function setupBackgroundAudio() {
    try {
        const response = await fetch('train_noise_to_techno.wav'); // Fetch the audio file
        const audioData = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(audioData);

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = true; // Loop the audio
        source.connect(audioContext.destination); // Connect only to speakers
        source.start();

        console.log("Background audio playing");
    } catch (err) {
        console.error("Error loading background audio", err);
    }
}

function updateAudioData() {
    analyser.getByteFrequencyData(frequencyData);
}

function setupTerrain() {
    for (let x = 0; x < cols; x++) {
        terrain[x] = [];
        for (let y = 0; y < rows; y++) {
            terrain[x][y] = 0;
        }
    }
}

function updateTerrain() {
    flying += 0.01;
    let yoff = flying;
    updateAudioData();
    const maxFreqIndex = Math.min(frequencyData.length, cols);
    for (let y = rows - 1; y >= 0; y--) {
        let xoff = 0;
        for (let x = 0; x < cols; x++) {
            const audioHeight = frequencyData[x % maxFreqIndex] / 255 * 50;
            terrain[x][y] = simplex.noise(xoff, yoff + playerZ / 100) * 20 + audioHeight;
            xoff += 0.2;
        }
        yoff += 0.2;
    }
}

function drawTerrain() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2.5);
    ctx.scale(1.5, 1.5);
    ctx.rotate(Math.PI / 2);

    ctx.strokeStyle = "rgb(0, 255, 0)";

    for (let y = 0; y < rows - 1; y++) {
        ctx.beginPath();
        for (let x = 0; x <= cols; x++) {
            const adjustedX = x % cols;
            const theta = (adjustedX / cols) * Math.PI * 2;
            const r = ((rows - 1 - y) / rows) * radius;
            const posX = Math.cos(theta) * r;
            const posY = Math.sin(theta) * r;

            if (r < hollowRadius) continue;

            const z = terrain[adjustedX][y];
            ctx.lineTo(posX, posY - z);
        }
        ctx.stroke();
    }
    ctx.resetTransform();
}

function animate() {
    playerZ += speed;
    updateTerrain();
    drawTerrain();
    requestAnimationFrame(animate);
}

// Add a button to capture and save the canvas
const saveButton = document.createElement('button');
saveButton.innerText = 'Save as Image';
saveButton.style.position = 'absolute';
saveButton.style.top = '10px';
saveButton.style.right = '10px';
saveButton.style.padding = '10px 20px';
saveButton.style.fontSize = '16px';
saveButton.style.zIndex = '10';
document.body.appendChild(saveButton);

saveButton.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'canvas_image.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
});

canvas.addEventListener("touchstart", () => {
    speed += 1;
});

canvas.addEventListener("touchend", () => {
    speed = Math.max(1, speed - 1);
});

// Initialize everything
setupMicrophone(); // Connect the microphone but prevent feedback
setupBackgroundAudio(); // Play background audio
setupTerrain();
animate();

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    setupTerrain();
});
