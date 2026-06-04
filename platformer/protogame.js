const canvas = document.getElementById('gameCanvas');
/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext('2d');

let inputState = {
    left: false,
    right: false,
    jumpedthisframe: false,
};
window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'A') inputState.left = true;
    if (event.key === 'ArrowRight' || event.key === 'D') inputState.right = true;
    if (event.key === 'ArrowUp' || event.key === 'W' || event.key === 'Space' && !event.repeat) inputState.jumpedthisframe = true;
});

window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'A') inputState.left = false;
    if (event.key === 'ArrowRight' || event.key === 'D') inputState.right = false;
});

const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

// components
const TransformComponent = new Map();
const VelocityComponent = new Map();
const GravityComponent = new Map();
const CollisionComponent = new Map();
const RenderComponent = new Map();
const PlayerControlComponent = new Map();
const JumpPhysicsComponent = new Map();

let nextEntityId = 0;

function createWall(x, y, width, height) {
    const entityId = nextEntityId++;
    TransformComponent.set(entityId, { x: x, y: y, width: width, height: height });
    CollisionComponent.set(entityId, { width: width, height: height });
    RenderComponent.set(entityId, { color: 'darkgray', width: width, height: height });
    return entityId;
}

function createPlayer(x = 100, y = 100) {
    const entityId = nextEntityId++;
    TransformComponent.set(entityId, { x: x, y: y });
    CollisionComponent.set(entityId, { width: 50, height: 50 });
    VelocityComponent.set(entityId, { x: 0, y: 0 });
    RenderComponent.set(entityId, { color: 'blue', width: 50, height: 50 });
    JumpPhysicsComponent.set(entityId, { jumpSpeed: 600, grounded: false });
    GravityComponent.set(entityId, { strength: 1500 });
    PlayerControlComponent.set(entityId, {});
    return entityId;
}

const isColliding = (e1, e2) => {
    const p1 = TransformComponent.get(e1);
    const p2 = TransformComponent.get(e2);
    const c1 = CollisionComponent.get(e1);
    const c2 = CollisionComponent.get(e2);
    return p1.x < p2.x + c2.width && p1.x + c1.width > p2.x && p1.y < p2.y + c2.height && p1.y + c1.height > p2.y;
};

function handleInput(dt) {
    for (const [entityId] of PlayerControlComponent.entries()) {
        const velocity = VelocityComponent.get(entityId);
        const position = TransformComponent.get(entityId);
        const collision = CollisionComponent.get(entityId);
        const jumpPhys = JumpPhysicsComponent.get(entityId);
        const moveSpeed = 300; // px/s target
        const smoothing = 12; // higher = snappier
        let targetX = 0;
        if (inputState.keys['ArrowLeft']) targetX = -moveSpeed;
        if (inputState.keys['ArrowRight']) targetX = moveSpeed;

        const amt = 1 - Math.exp(-smoothing * dt);
        velocity.x = lerp(velocity.x, targetX, amt);

        // jump: only when grounded
        const ctrl = PlayerControlComponent.get(entityId);
        const jumpSpeed = 600; // px/s
        if (inputState.keys['ArrowUp'] && ctrl.grounded) {
            velocity.y = -jumpSpeed;
            ctrl.grounded = false;
        }
    }
}

function update(dt) {
    // apply gravity
    for (const [entityId, gravity] of GravityComponent.entries()) {
        const velocity = VelocityComponent.get(entityId);
        velocity.y += gravity.strength * dt;
    }

    // integrate velocities
    for (const [entityId, velocity] of VelocityComponent.entries()) {
        const position = TransformComponent.get(entityId);
        position.x += velocity.x * dt;
        position.y += velocity.y * dt;
        // small-speed snap
        if (Math.abs(velocity.x) < 5) velocity.x = 0;
    }

    // simple floor collision
    for (const [entityId, position] of TransformComponent.entries()) {
        const collision = CollisionComponent.get(entityId);
        if (!collision) continue;
        const vel = VelocityComponent.get(entityId);
        if (position.y + collision.height > canvas.height) {
            position.y = canvas.height - collision.height;
            if (vel) vel.y = 0;
            const ctrl = PlayerControlComponent.get(entityId);
            if (ctrl) ctrl.grounded = true;
        } else {
            const ctrl = PlayerControlComponent.get(entityId);
            if (ctrl) ctrl.grounded = false;
        }
    }
}

function render() {
    for (const [entityId, render] of RenderComponent.entries()) {
        const position = TransformComponent.get(entityId);
        ctx.fillStyle = render.color;
        ctx.fillRect(position.x, position.y, render.width, render.height);
    }
}

const player = createPlayer(100, 113);

let lastTime = null;
function gameLoop(now) {
    if (!lastTime) lastTime = now;
    let dt = (now - lastTime) / 1000; // seconds
    lastTime = now;
    // clamp to avoid huge jumps when switching tabs or paused
    dt = Math.min(dt, 0.05);

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    handleInput(dt);
    update(dt);
    render();
    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);