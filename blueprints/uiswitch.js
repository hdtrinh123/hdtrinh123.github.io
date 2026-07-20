const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let state = 'mainMenu'; // Whatever game states (mainMenu, selection, playing, gameOver)

function initialize() {
    setupUI();
    state = 'mainMenu'; // Set initial state to main menu
    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if(state !== 'playing') {
        // Background of the menus
    }
    if (state === 'playing') {
        // Game logic and rendering
    }
    requestAnimationFrame(gameLoop);
}

function setupUI() {
    // Have each button just call a function
    document.getElementById('startButton').addEventListener('click', startGame);
    document.getElementById('instructionsButton').addEventListener('click', instructions);
    document.getElementById('settingsButton').addEventListener('click', settings);
    // For buttons that appear multiple times, use a class and querySelectorAll to add event listeners to all of them at once
    document.querySelectorAll('.backToMenuButton').forEach(button => {
        button.addEventListener('click', mainMenu);
    });
}

function hideAllPanels() {
    document.querySelectorAll('.ui-element').forEach(panel => {
        panel.classList.remove('active');
    });
}

function startGame() {
    hideAllPanels();
    state = 'playing';
}

function mainMenu() {
    hideAllPanels();
    document.getElementById('mainMenu').classList.add('active');
}

function instructions() {
    hideAllPanels();
    document.getElementById('instructionsPanel').classList.add('active');
}

function settings() {
    hideAllPanels();
    document.getElementById('settingsPanel').classList.add('active');
}