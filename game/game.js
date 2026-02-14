// ============================================
// Matter.js aliases
// ============================================
const { Engine, Bodies, Body, Composite, Events } = Matter;

// ============================================
// State
// ============================================
let db, userId, username, userColor;
let engine, mWorld, canvas, ctx;
let scale = 1;
let camera = { x: 0, y: 0 };

// Single physics body per player
let pBody = null;
let remotePlayers = {};
let remoteBodies = {};
let platforms = [];
let particles = [];

let keys = {};
let mouseWorld = { x: 400, y: 300 };
let clickedThisFrame = false;
let dragDist = 0;
let mouseDownPos = null;

let groundedFrames = 0;
let wasGrounded = false;
let grabTarget = null;
let lastSyncTime = 0;
let walkCycle = 0;
let headAngle = 0;
let beakCloseTimer = 0;

// ============================================
// Helpers
// ============================================
function getUserId() {
    return 'u_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function pickColor() {
    return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
}

function darken(hex, amt) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) * (1 - amt));
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) * (1 - amt));
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) * (1 - amt));
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
}

function screenToWorld(sx, sy) {
    return { x: sx / scale + camera.x, y: sy / scale + camera.y };
}

// ============================================
// Init & Join
// ============================================
function initFirebase() {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

function joinGame() {
    const input = document.getElementById('username-input');
    username = input.value.trim() || 'Player' + Math.floor(Math.random() * 1000);
    userId = getUserId();
    userColor = pickColor();

    document.getElementById('join-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');

    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    resize();

    initPhysics();
    buildWorld();
    createLocalPlayer();
    setupInput();
    setupFirebase();
    requestAnimationFrame(loop);
}

// ============================================
// Physics World
// ============================================
function initPhysics() {
    engine = Engine.create({ gravity: { x: 0, y: 0.4 } });
    mWorld = engine.world;
}

function buildWorld() {
    const W = WORLD.width, H = WORLD.height;
    const defs = [
        [W/2, H-20, W+100, 40],
        [-20, H/2, 40, H+100], [W+20, H/2, 40, H+100],
        [W/2, -20, W+100, 40],
        [200,1000,220,22],[550,960,180,22],[950,1000,280,22],
        [1400,960,200,22],[1800,1000,240,22],[2200,960,180,22],
        [120,810,180,22],[450,760,220,22],[850,800,200,22],
        [1200,740,260,22],[1600,780,200,22],[2000,800,220,22],[2350,740,160,22],
        [280,580,200,22],[650,530,180,22],[1050,560,200,22],
        [1400,500,240,22],[1780,540,200,22],[2150,520,200,22],
        [150,380,160,22],[500,340,200,22],[900,300,160,22],
        [1250,340,200,22],[1600,310,180,22],[2000,360,180,22],
        [350,170,150,22],[750,130,180,22],[1150,110,160,22],
        [1550,140,180,22],[1950,170,150,22],
    ];
    defs.forEach(([x, y, w, h]) => {
        const body = Bodies.rectangle(x, y, w, h, {
            isStatic: true, friction: 0.8, restitution: 0.15
        });
        Composite.add(mWorld, body);
        platforms.push({ x, y, w, h });
    });
}

// ============================================
// Local Player (single body)
// ============================================
function createLocalPlayer() {
    const x = WORLD.width / 2, y = WORLD.height - 100;
    pBody = Bodies.circle(x, y, RAG.torso, {
        density: 0.002, friction: 0.5, restitution: 0.3, frictionAir: 0.02
    });
    Composite.add(mWorld, pBody);

    Events.on(engine, 'collisionActive', (event) => {
        for (const pair of event.pairs) {
            const isMe = pair.bodyA === pBody || pair.bodyB === pBody;
            if (!isMe) continue;
            const other = pair.bodyA === pBody ? pair.bodyB : pair.bodyA;
            if (other.position.y > pBody.position.y) {
                groundedFrames = PHYSICS.coyoteFrames;
            }
        }
    });
}

// ============================================
// Remote Player Bodies
// ============================================
function updateRemoteBodies() {
    for (const [id, p] of Object.entries(remotePlayers)) {
        if (!remoteBodies[id]) {
            const body = Bodies.circle(p.dx, p.dy, RAG.torso + 4, {
                density: 0.006, restitution: 0.3,
                friction: 0.4, frictionAir: 0.05,
                label: 'remote_' + id
            });
            Composite.add(mWorld, body);
            remoteBodies[id] = body;
        }
        const body = remoteBodies[id];
        body.isSensor = (grabTarget === id);
        const dx = p.dx - body.position.x;
        const dy = p.dy - body.position.y;
        Body.applyForce(body, body.position, {
            x: dx * PHYSICS.remoteSpring,
            y: dy * PHYSICS.remoteSpring
        });
        Body.setVelocity(body, {
            x: body.velocity.x * PHYSICS.remoteDamp,
            y: body.velocity.y * PHYSICS.remoteDamp
        });
    }
    for (const id of Object.keys(remoteBodies)) {
        if (!remotePlayers[id]) {
            Composite.remove(mWorld, remoteBodies[id]);
            delete remoteBodies[id];
            if (grabTarget === id) grabTarget = null;
        }
    }
}

// ============================================
// Input
// ============================================
function setupInput() {
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

    canvas.addEventListener('mousemove', (e) => {
        mouseWorld = screenToWorld(e.clientX, e.clientY);
        if (mouseDownPos) {
            dragDist += Math.abs(e.clientX - mouseDownPos.x) + Math.abs(e.clientY - mouseDownPos.y);
            mouseDownPos = { x: e.clientX, y: e.clientY };
        }
    });
    canvas.addEventListener('mousedown', (e) => { mouseDownPos = { x: e.clientX, y: e.clientY }; dragDist = 0; });
    canvas.addEventListener('mouseup', () => { if (dragDist < 12) clickedThisFrame = true; mouseDownPos = null; });

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); handleTouches(e.touches);
        mouseWorld = screenToWorld(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        clickedThisFrame = true;
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault(); handleTouches(e.touches);
        mouseWorld = screenToWorld(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (e.touches.length === 0) { keys['_touchL'] = keys['_touchR'] = keys['_touchJ'] = false; }
        else handleTouches(e.touches);
    }, { passive: false });
}

function handleTouches(touches) {
    keys['_touchL'] = keys['_touchR'] = keys['_touchJ'] = false;
    for (const t of touches) {
        if (t.clientX < canvas.width * 0.35) keys['_touchL'] = true;
        else if (t.clientX > canvas.width * 0.65) keys['_touchR'] = true;
        if (t.clientY < canvas.height * 0.45) keys['_touchJ'] = true;
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    scale = canvas.width / WORLD.viewWidth;
}

// ============================================
// Firebase Sync
// ============================================
function setupFirebase() {
    const ref = db.ref('players/' + userId);
    db.ref('.info/connected').on('value', (snap) => {
        if (snap.val() === true) {
            ref.onDisconnect().remove();
            ref.set({
                name: username, color: userColor,
                x: pBody.position.x, y: pBody.position.y,
                ha: 0, grab: null, gx: null, gy: null,
                t: firebase.database.ServerValue.TIMESTAMP
            });
        }
    });

    db.ref('players').on('value', (snap) => {
        const data = snap.val() || {};
        let count = 0;
        const next = {};
        for (const [id, p] of Object.entries(data)) {
            count++;
            if (id === userId) continue;
            const prev = remotePlayers[id];
            next[id] = {
                ...p,
                dx: prev ? prev.dx : p.x,
                dy: prev ? prev.dy : p.y,
                dha: prev ? prev.dha : (p.ha || 0),
                walkPhase: prev ? prev.walkPhase : 0,
                prevDx: prev ? prev.prevDx : p.x,
            };
        }
        remotePlayers = next;
        document.getElementById('player-count').textContent = count + ' online';
    });
}

function syncOut() {
    const now = Date.now();
    if (now - lastSyncTime < SYNC_RATE) return;
    lastSyncTime = now;
    if (!pBody || !db) return;

    let gx = null, gy = null;
    if (grabTarget) {
        const head = getHeadPos(pBody.position.x, pBody.position.y, grabTarget);
        gx = Math.round(head.x + Math.cos(headAngle) * (RAG.head + RAG.beakLen));
        gy = Math.round(head.y + Math.sin(headAngle) * (RAG.head + RAG.beakLen));
    }
    db.ref('players/' + userId).update({
        x: Math.round(pBody.position.x),
        y: Math.round(pBody.position.y),
        ha: Math.round(headAngle * 100) / 100,
        grab: grabTarget || null, gx: gx, gy: gy,
        t: firebase.database.ServerValue.TIMESTAMP
    });
}

// ============================================
// Game Logic
// ============================================
function update() {
    if (!pBody) return;
    const pos = pBody.position;
    const vel = pBody.velocity;

    const left  = keys['a'] || keys['arrowleft']  || keys['_touchL'];
    const right = keys['d'] || keys['arrowright'] || keys['_touchR'];
    const jump  = keys['w'] || keys['arrowup'] || keys[' '] || keys['_touchJ'];

    if (left)  Body.applyForce(pBody, pos, { x: -PHYSICS.moveForce, y: 0 });
    if (right) Body.applyForce(pBody, pos, { x:  PHYSICS.moveForce, y: 0 });

    if (Math.abs(vel.x) > PHYSICS.maxSpeed) {
        Body.setVelocity(pBody, { x: Math.sign(vel.x) * PHYSICS.maxSpeed, y: vel.y });
    }

    if (jump && groundedFrames > 0) {
        Body.setVelocity(pBody, { x: vel.x, y: -PHYSICS.jumpSpeed });
        groundedFrames = 0;
        spawnParticles(pos.x, pos.y + RAG.torso, 6, -1);
    }
    if (groundedFrames > 0) groundedFrames--;

    const grounded = groundedFrames > 0;
    if (grounded && !wasGrounded && vel.y > 2) {
        spawnParticles(pos.x, pos.y + RAG.torso, 8, -1);
    }
    wasGrounded = grounded;

    // Walk cycle
    const speed = Math.abs(vel.x);
    if (speed > 0.3) walkCycle += speed * 0.18;

    // Head angle + grab state (from grab.js)
    computeHeadState();
    if (beakCloseTimer > 0) beakCloseTimer--;

    // Interpolate remote players
    const lerp = 0.25;
    for (const p of Object.values(remotePlayers)) {
        p.prevDx = p.dx;
        p.dx += (p.x - p.dx) * lerp;
        p.dy += (p.y - p.dy) * lerp;
        let adiff = (p.ha || 0) - p.dha;
        while (adiff > Math.PI) adiff -= Math.PI * 2;
        while (adiff < -Math.PI) adiff += Math.PI * 2;
        p.dha += adiff * lerp;
        const remoteVx = p.dx - p.prevDx;
        if (Math.abs(remoteVx) > 0.3) p.walkPhase += Math.abs(remoteVx) * 0.6;
    }

    updateRemoteBodies();
    handleGrab();       // from grab.js
    applyGrabForces();  // from grab.js
    updateParticles();
    Engine.update(engine, 1000 / 60);

    // Respawn
    if (pos.y > WORLD.height + 100 || pos.x < -100 || pos.x > WORLD.width + 100) {
        Body.setPosition(pBody, { x: WORLD.width / 2, y: WORLD.height - 100 });
        Body.setVelocity(pBody, { x: 0, y: 0 });
        grabTarget = null;
    }

    updateCamera();
    syncOut();
    clickedThisFrame = false;
}

function updateCamera() {
    const vw = canvas.width / scale, vh = canvas.height / scale;
    const tx = pBody.position.x - vw / 2;
    const ty = pBody.position.y - vh / 2;
    camera.x += (tx - camera.x) * 0.08;
    camera.y += (ty - camera.y) * 0.08;
    camera.x = Math.max(0, Math.min(WORLD.width - vw, camera.x));
    camera.y = Math.max(0, Math.min(WORLD.height - vh, camera.y));
}

// ============================================
// Particles
// ============================================
function spawnParticles(x, y, count, yDir) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y, vx: (Math.random() - 0.5) * 4, vy: yDir * Math.random() * 3.5,
            life: 1, decay: 0.025 + Math.random() * 0.02, size: 2 + Math.random() * 3
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

// ============================================
// Game Loop
// ============================================
function loop() { update(); render(); requestAnimationFrame(loop); }

// ============================================
// Boot
// ============================================
initFirebase();
document.getElementById('join-btn').addEventListener('click', joinGame);
document.getElementById('username-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') joinGame(); });
