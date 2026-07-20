let canvas = document.getElementById('canvas');
/** @type {CanvasRenderingContext2D} */
let ctx = canvas.getContext('2d');
const boundRect = canvas.getBoundingClientRect()
canvas.width = boundRect.width
canvas.height = boundRect.height

const input = {
    clicked: false,
    x: 0, // Changed from mousex to match listener
    prevx: 0,
    y: 0,  // Changed from mousey to match listener
    prevy: 0,
    i: 0 //index of the cell in the world array

}

let width = 50;
let height = 50;
let scale = 10;

let material = 0;
let brushSize = 1;

document.getElementById("materialSelector").addEventListener("change", (e) => {
    material = parseInt(e.target.value);
});

// FIX 1: Use Array.from to create a unique object for every single cell
const world = Array.from({ length: width * height }, () => ({ type: 0, color: "rgb(0,0,0)", updated:false, dx:0, dy:0 }));

function setpx(i, type) {
    world[i].type = type;
    if (type == 1) {
        // FIX 2: Directly assign a new color string to this specific cell
        world[i].color = `rgb(${Math.random() * 25 + 225},${Math.random() * 75 + 180},0)`;
    }
    if (type == 0){
        world[i].color = "rgb(0,0,0)";
    }
}

canvas.addEventListener("pointermove", (e) => {
    input.x = (e.clientX - boundRect.left) * (canvas.width / boundRect.width) / scale;
    input.y = (e.clientY - boundRect.top) * (canvas.height / boundRect.height) / scale * width;
    input.i = Math.floor(input.y) * width + Math.floor(input.x);
});

// Note: pointerdown toggles draw mode on/off in your current setup
canvas.addEventListener("pointerdown", () => {
    input.clicked = !input.clicked;
});

function swap(a, b) {
    world[a].updated=true;
    world[b].updated=true;
    [world[a], world[b]] = [world[b], world[a]];
}

function update() {
    if (input.clicked) {
        let i = Math.floor(input.y / width) * width + Math.floor(input.x);
        if (world[i]) {
            setpx(i, material);
        }
    }
    for(let i = 0; i < world.length; i++){
        world[i].updated = false
    }
    //stage 1: 
    for(let i = 0; i < world.length; i++){
        if(world[i].updated) continue;
        if(world[i]?.type==1){ //if sand
            if(world[i+width]?.type==0){  // try to move down
                swap(i,i+width);
            } else {
                let direction = Math.random() < 0.5 ? -1 : 1; // randomly choose left or right
                if(world[i+width+direction]?.type==0){ // try to move down left or right
                    swap(i,i+width+direction);
                }
            }
        }
    } 

}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgb(79, 79, 85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < world.length; i++) {
        let x = i % width;
        let y = Math.floor(i / width);
        ctx.fillStyle = world[i].color;
        ctx.fillRect(x * scale + 1, y * scale + 1, scale - 1, scale - 1);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}
gameLoop();
