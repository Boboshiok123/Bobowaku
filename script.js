// Create the canvas and context
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

// Set canvas size to fit the screen
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Game variables
let player = { 
    x: 50, 
    y: canvas.height - 100, 
    width: 50, 
    height: 50, 
    color: 'blue', 
    dy: 0, 
    gravity: 1, 
    jumpPower: -15 
};
let obstacles = [];
let frameCount = 0;
let isGameOver = false;
let score = 0;

// Listen for key presses to make the player jump
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && player.y === canvas.height - player.height) {
        player.dy = player.jumpPower;
    }
});

// Add touch controls for mobile
document.addEventListener('touchstart', () => {
    if (player.y === canvas.height - player.height) {
        player.dy = player.jumpPower;
    }
});

// Game loop
function gameLoop() {
    if (isGameOver) {
        ctx.font = '30px Arial';
        ctx.fillStyle = 'red';
        ctx.fillText('Game Over! Reload to Restart', canvas.width / 2 - 150, canvas.height / 2);
        return;
    }

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update the player
    player.dy += player.gravity;
    player.y += player.dy;
    if (player.y > canvas.height - player.height) {
        player.y = canvas.height - player.height;
        player.dy = 0;
    }

    // Draw the player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Generate obstacles
    frameCount++;
    if (frameCount % 100 === 0) {
        let height = Math.random() * (canvas.height / 2) + 20;
        obstacles.push({ x: canvas.width, y: canvas.height - height, width: 20, height, color: 'red' });
    }

    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.x -= 5; // Move obstacle to the left

        // Check for collisions
        if (
            player.x < obs.x + obs.width &&
            player.x + player.width > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.height > obs.y
        ) {
            isGameOver = true;
        }

        // Remove off-screen obstacles
        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
            score++;
        }

        // Draw obstacle
        ctx.fillStyle = obs.color;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    }

    // Draw score
    ctx.font = '20px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText(`Score: ${score}`, 10, 30);

    // Continue the game loop
    requestAnimationFrame(gameLoop);
}

// Start the game
requestAnimationFrame(gameLoop);

// Adjust canvas size on window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    player.y = canvas.height - player.height;

    // Adjust obstacles position
    obstacles.forEach(obs => {
        obs.y = canvas.height - obs.height;
    });
});
