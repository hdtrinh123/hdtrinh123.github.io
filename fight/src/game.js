const canvas = document.getElementById('gameCanvas');
/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let state = 'mainMenu'; // Possible states: mainMenu, selection, playing, gameOver


// let player = new Player(canvas.width / 2, canvas.height - 50);

function lerp(start, end, amount) {
    return start + (end - start) * amount
}

initialize();

function initialize() {
    setupUI();
    // ctx.fillStyle='rgb(166, 66, 191)'
    ctx.fillRect(0,0,canvas.width,canvas.height)
}

//UI and setup
function setupUI() {
    document.getElementById('startButton').addEventListener('click', startGame);
    document.getElementById('instructionsButton').addEventListener('click', instructions);
    document.getElementById('settingsButton').addEventListener('click', settings);
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
    state='playing'
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

//Actual game

const P1_CONFIG = {
    left: 'KeyA',
    right: 'KeyD',
    jump: 'KeyW',
    down: 'KeyS',
    punch: 'KeyZ'
};

const P2_CONFIG = {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    jump: 'ArrowUp',
    down: 'ArrowDown',
    punch: 'KeyJ'
};

const input = {
    held: new Set(),
    pressed: new Set(),
    isHeld(...keys) { return keys.some((k) => this.held.has(k)); },
    wasPressed(...keys) { return keys.some((k) => this.pressed.has(k)); },
    clearFrame() { this.pressed.clear(); },
};

window.addEventListener('keydown', (event) => {
    if (!event.repeat) input.pressed.add(event.code);
    input.held.add(event.code);
});

window.addEventListener('keyup', (event) => {
    input.held.delete(event.code);
});



class World {
    constructor() {
        this.entities = [];
    }

    add(entity) {
        this.entities.push(entity);
        return entity;
    }

    get bullets() {
        return this.entities.filter((e) => e.bullet);
    }

    update(dt) {
        for (const entity of this.entities) entity.update(dt, this);
    }

    render(context) {
        ctx.clearRect(0,0,canvas.width,canvas.height)
        for (const entity of this.entities) entity.render(context);
    }
}


class Entity {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
    }

    // AABB overlap test against another entity.
    intersects(other) {
        return (
            this.x < other.x + other.width &&
            this.x + this.width > other.x &&
            this.y < other.y + other.height &&
            this.y + this.height > other.y
        );
    }

    update(_dt) {

    }

    render(context) {
        context.fillStyle = this.color;
        context.fillRect(this.x, this.y, this.width, this.height);
    }
}


class Player extends Entity {
    constructor(x = 100, y = 100, image, direction, config) {
        super(x, y, 160, 180);
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
        this.jumpbuffer = 0; // keep jump input for buffer distance ms
        this.justjumped = false;
        this.stunned = false
        this._contactX = false;
        this._contactY = false;
        this.direction = direction
        this.config=config

        // Tuning (carried over from the ECS prototype).
        this.moveSpeed = 300;   // px/s horizontal target
        this.smoothing = 12;    // higher = snappier accel/decel
        this.jumpSpeed = 600;   // px/s launch
        this.jumpBufferTime = 0.1 * 1000; //jump at most 0.1 seconds before the ground
        this.coyoteTimeLimit = 0.1 * 1000; // milliseconds to allow jumping after leaving a platform
        this.gravity = 1500;    // px/s^2

        this.imgscale = 10
        this.animationpos = 0
        this.sheetX = [0,1,0,2]
        this.sheetY = 0
        this.img = image
        this.animationMs = 200
        this.animationTime = this.animationMs
    }
    update(dt) {
        let dir=0
        if(input.isHeld(this.config.left)) dir-=1
        if(input.isHeld(this.config.right)) dir+=1
        this.vx = lerp(this.vx,dir*this.moveSpeed*dt,0.3)
        if(input.wasPressed(this.config.jump) && this.grounded == true){
            this.vy-=10
            input.clearFrame()
        }
        if(this.y+this.height<500){
            this.vy+=0.5;
            this.grounded=false
        }
        this.x+=this.vx
        this.y+=this.vy
        if(this.y+this.height>=500){
            this.vy=0
            this.y=500-this.height
            this.grounded=true
        }
        if(this.animationTime<0){
        if(dir==1){
            this.sheetY=3
            this.animationpos=(this.animationpos+1)%4
        }
        if(dir==-1){
            this.sheetY=2
            this.animationpos=(this.animationpos+1)%4
        }
        if (dir==0){
            this.animationpos=0
        }
        this.animationTime=this.animationMs
        }
        this.animationTime-=dt*1000
    }
    render(context) {
        ctx.drawImage(this.img, (this.sheetX[this.animationpos])*16, this.sheetY*18, 16, 18, this.x, this.y, 16*this.imgscale, 18*this.imgscale)
    }
}

const world = new World()
let img1 = new Image();
img1.onload = ()=>{
    console.log("create world")
    const player1 = world.add(new Player(150,500,img1,1, P1_CONFIG))
    const player2 = world.add(new Player(650,500,img1,-1, P2_CONFIG))
    requestAnimationFrame(gameLoop);
    console.log("IMAGE HAS LOADED")
}
img1.onerror = (err) => {
    console.error("Failed to load image at:", img1.src, err);
};

img1.src = './assets/rpgspritehsheet.png'



let time = 0;
let lastTime;

function gameLoop() {
    time = performance.now();
    if (!lastTime) lastTime = time;
    let dt = (time - lastTime) / 1000; // seconds
    lastTime = time;
    dt = Math.min(dt, 0.05); // clamp big jumps (tab switches / pauses)

    if (state !== 'playing') {
        // ctx.fillStyle = 'rgba(179, 157, 200, 0.03)';
        ctx.fillStyle = 'rgb(179, 157, 200)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(166, 66, 191, 0.33)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        const ySpacing = canvas.height / 8;
        const yOffset = (time * 0.05) % ySpacing;
        for (let i = 0; i < 8; i++) {
            let y = ySpacing * i + yOffset;
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
        }
        ctx.stroke();

        ctx.beginPath();
        const xSpacing = canvas.width / 10;
        const xOffset = (time * 0.05) % xSpacing;
        for (let i = 0; i < 10; i++) {
            let x = xSpacing * i + xOffset;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
        }
        ctx.stroke();

    }

    if (state === 'playing') {
        world.update(dt)
        world.render(ctx)
    }

    requestAnimationFrame(gameLoop);
}
