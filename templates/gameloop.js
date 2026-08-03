let canvas = document.getElementById('canvas');
/** @type {CanvasRenderingContext2D} */
let ctx = canvas.getContext('2d');

const input = {
    clicked: false,
}
let lastTime=0
let deltaTime=0

canvas.addEventListener("pointerdown", () => {
    input.clicked = !input.clicked;
});
canvas.addEventListener("keydown", (e) => {
});

function update(dt) {
    //In here does the logic of the game, like updating positions, checking for collisions, etc.
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    //In here does the rendering of the game, like drawing the background, characters, etc.
}

function gameLoop() {
    deltaTime=performance.now()-lastTime
    update(deltaTime); //Update first
    draw(); //Then draw the updated state
    requestAnimationFrame(gameLoop);
    lastTime=performance.now()
}
gameLoop();
