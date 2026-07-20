let canvas = document.getElementById('canvas');
/** @type {CanvasRenderingContext2D} */
let ctx = canvas.getContext('2d');

const input = {
    clicked: false,
}

// Note: pointerdown toggles draw mode on/off in your current setup
canvas.addEventListener("pointerdown", () => {
    input.clicked = !input.clicked;
});

function update() {
    //In here does the logic of the game, like updating positions, checking for collisions, etc.
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    //In here does the rendering of the game, like drawing the background, characters, etc.
}

function gameLoop() {
    update(); //Update first
    draw(); //Then draw the updated state
    requestAnimationFrame(gameLoop);
}
gameLoop();
