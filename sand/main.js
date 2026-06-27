let canvas = document.getElementById('canvas');
/** @type {CanvasRenderingContext2D} */ 
let ctx = canvas.getContext('2d');

const boundRect = canvas.getBoundingClientRect()
canvas.width = boundRect.width
canvas.height = boundRect.height
const input = {
    clicked: false,
    mousex: 0,
    mousey: 0
}
canvas.addEventListener("pointermove", (e) => {
    input.x = (e.clientX - boundRect.left) * (canvas.width / boundRect.width);
    input.y = (e.clientY - boundRect.top) * (canvas.height / boundRect.height);
    if(input.clicked){
        console.log("drawing with at x:"+(input.x/scale)+", y:"+input.y/scale)
        world[width*Math.floor(input.y/scale)+Math.floor((input.x/scale))%width]=1
    }
});
canvas.addEventListener("pointerdown", () => {
    input.clicked = ! input.clicked;
});

let width = 50;
let height = 50;
let scale = 10; // Size of each cell in pixels

const world = new Array(width * height).fill({type,color,});

function update() {
    for(let i = 0; i < world.length; i++){
        if(world[i]==1){
            if(world[i+width]==0){
                world[i+width]=1
                world[i]=0
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
        if(world[i]===1) ctx.fillStyle = "yellow";
        else ctx.fillStyle = "rgb(50, 50, 52)";
        
        ctx.fillRect(x * scale+1, y * scale+1, scale - 1, scale - 1); 
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
