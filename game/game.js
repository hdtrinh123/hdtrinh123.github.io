// ============================================
// Matter.js aliases
// ============================================
const { Engine, Bodies, Body, Composite, Events, Vector } = Matter;

// ============================================
// State
// ============================================
let db;
let userId;
let username;
let userColor;

let engine, mWorld;
let canvas, ctx;
let scale = 1;
let camera = { x: 0, y: 0 };

let localBody = null;
let remotePlayers = {};
let remoteBodies = {};
let staticBodies = [];
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
let armAngle = 0;

// ============================================
// Helpers
// ============================================
function getUserId() {
    // Use sessionStorage so each tab gets its own unique ID
    let id = sessionStorage.getItem('physics_userId');
    if (!id) {
        id = 'u_' + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 4);
        sessionStorage.setItem('physics_userId', id);
    }
    return id;
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
    return {
        x: sx / scale + camera.x,
        y: sy / scale + camera.y
    };
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
    spawnPlayer();
    setupInput();
    setupFirebase();

    requestAnimationFrame(loop);
}

// ============================================
// Physics
// ============================================
function initPhysics() {
    engine = Engine.create({ gravity: { x: 0, y: 1.8 } });
    mWorld = engine.world;
}

function buildWorld() {
    const W = WORLD.width;
    const H = WORLD.height;

    const defs = [
        // Ground
        [W / 2, H - 20, W + 100, 40],
        // Walls
        [-20, H / 2, 40, H + 100],
        [W + 20, H / 2, 40, H + 100],
        // Ceiling
        [W / 2, -20, W + 100, 40],

        // === Tier 1 (low) ===
        [200, 1000, 220, 22],
        [550, 960, 180, 22],
        [950, 1000, 280, 22],
        [1400, 960, 200, 22],
        [1800, 1000, 240, 22],
        [2200, 960, 180, 22],

        // === Tier 2 ===
        [120, 810, 180, 22],
        [450, 760, 220, 22],
        [850, 800, 200, 22],
        [1200, 740, 260, 22],
        [1600, 780, 200, 22],
        [2000, 800, 220, 22],
        [2350, 740, 160, 22],

        // === Tier 3 ===
        [280, 580, 200, 22],
        [650, 530, 180, 22],
        [1050, 560, 200, 22],
        [1400, 500, 240, 22],
        [1780, 540, 200, 22],
        [2150, 520, 200, 22],

        // === Tier 4 ===
        [150, 380, 160, 22],
        [500, 340, 200, 22],
        [900, 300, 160, 22],
        [1250, 340, 200, 22],
        [1600, 310, 180, 22],
        [2000, 360, 180, 22],

        // === Tier 5 (top) ===
        [350, 170, 150, 22],
        [750, 130, 180, 22],
        [1150, 110, 160, 22],
        [1550, 140, 180, 22],
        [1950, 170, 150, 22],
    ];

    defs.forEach(([x, y, w, h]) => {
        const body = Bodies.rectangle(x, y, w, h, {
            isStatic: true,
            friction: 0.8,
            restitution: 0.15
        });
        Composite.add(mWorld, body);
        staticBodies.push(body);
        platforms.push({ x, y, w, h });
    });
}

function spawnPlayer() {
    const x = WORLD.width / 2;
    const y = WORLD.height - 80;

    localBody = Bodies.circle(x, y, PHYSICS.playerRadius, {
        friction: PHYSICS.friction,
        restitution: PHYSICS.restitution,
        density: 0.002,
        frictionAir: PHYSICS.airFriction
    });
    Composite.add(mWorld, localBody);

    // Ground detection
    Events.on(engine, 'collisionActive', (event) => {
        for (const pair of event.pairs) {
            const isMe = pair.bodyA === localBody || pair.bodyB === localBody;
            if (!isMe) continue;
            const other = pair.bodyA === localBody ? pair.bodyB : pair.bodyA;
            if (!other.isStatic) continue;
            if (other.position.y > localBody.position.y) {
                groundedFrames = PHYSICS.coyoteFrames;
            }
        }
    });
}

// ============================================
// Remote Player Collision Bodies
// ============================================
function updateRemoteBodies() {
    // Create or move bodies for current remote players
    for (const [id, p] of Object.entries(remotePlayers)) {
        if (!remoteBodies[id]) {
            const body = Bodies.circle(p.dx, p.dy, PHYSICS.playerRadius, {
                isStatic: true,
                restitution: 0.3,
                friction: 0.5,
                label: 'remote_' + id
            });
            Composite.add(mWorld, body);
            remoteBodies[id] = body;
        }
        Body.setPosition(remoteBodies[id], { x: p.dx, y: p.dy });
    }

    // Remove bodies for disconnected players
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
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
            e.preventDefault();
        }
    });
    window.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
    });

    canvas.addEventListener('mousemove', (e) => {
        mouseWorld = screenToWorld(e.clientX, e.clientY);
        if (mouseDownPos) {
            dragDist += Math.abs(e.clientX - mouseDownPos.x) + Math.abs(e.clientY - mouseDownPos.y);
            mouseDownPos = { x: e.clientX, y: e.clientY };
        }
    });
    canvas.addEventListener('mousedown', (e) => {
        mouseDownPos = { x: e.clientX, y: e.clientY };
        dragDist = 0;
    });
    canvas.addEventListener('mouseup', () => {
        if (dragDist < 12) clickedThisFrame = true;
        mouseDownPos = null;
    });

    // Touch
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleTouches(e.touches);
        const t = e.changedTouches[0];
        mouseWorld = screenToWorld(t.clientX, t.clientY);
        clickedThisFrame = true;
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        handleTouches(e.touches);
        const t = e.touches[0];
        mouseWorld = screenToWorld(t.clientX, t.clientY);
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (e.touches.length === 0) {
            keys['_touchL'] = false;
            keys['_touchR'] = false;
            keys['_touchJ'] = false;
        } else {
            handleTouches(e.touches);
        }
    }, { passive: false });
}

function handleTouches(touches) {
    keys['_touchL'] = false;
    keys['_touchR'] = false;
    keys['_touchJ'] = false;
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
    const connRef = db.ref('.info/connected');

    connRef.on('value', (snap) => {
        if (snap.val() === true) {
            ref.onDisconnect().remove();
            ref.set({
                name: username,
                color: userColor,
                x: localBody.position.x,
                y: localBody.position.y,
                vx: 0, vy: 0,
                arm: 0,
                grab: null,
                gx: null, gy: null,
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
                da: prev ? prev.da : (p.arm || 0)
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
    if (!localBody || !db) return;

    const p = localBody.position;
    const v = localBody.velocity;

    // Compute arm tip position (grab point) for grabbed player's client
    let gx = null, gy = null;
    if (grabTarget) {
        const armLen = PHYSICS.playerRadius + 36;
        gx = Math.round(p.x + Math.cos(armAngle) * armLen);
        gy = Math.round(p.y + Math.sin(armAngle) * armLen);
    }

    db.ref('players/' + userId).update({
        x: Math.round(p.x),
        y: Math.round(p.y),
        vx: Math.round(v.x * 10) / 10,
        vy: Math.round(v.y * 10) / 10,
        arm: Math.round(armAngle * 100) / 100,
        grab: grabTarget || null,
        gx: gx, gy: gy,
        t: firebase.database.ServerValue.TIMESTAMP
    });
}

// ============================================
// Game Logic
// ============================================
function update() {
    if (!localBody) return;
    const pos = localBody.position;
    const vel = localBody.velocity;

    // Arm angle follows mouse
    armAngle = Math.atan2(mouseWorld.y - pos.y, mouseWorld.x - pos.x);

    // Movement
    const left = keys['a'] || keys['arrowleft'] || keys['_touchL'];
    const right = keys['d'] || keys['arrowright'] || keys['_touchR'];
    const jump = keys['w'] || keys['arrowup'] || keys[' '] || keys['_touchJ'];

    if (left) Body.applyForce(localBody, pos, { x: -PHYSICS.moveForce, y: 0 });
    if (right) Body.applyForce(localBody, pos, { x: PHYSICS.moveForce, y: 0 });

    // Speed cap
    if (Math.abs(vel.x) > PHYSICS.maxSpeed) {
        Body.setVelocity(localBody, { x: Math.sign(vel.x) * PHYSICS.maxSpeed, y: vel.y });
    }

    // Jump
    if (jump && groundedFrames > 0) {
        Body.setVelocity(localBody, { x: vel.x, y: -PHYSICS.jumpSpeed });
        groundedFrames = 0;
        spawnParticles(pos.x, pos.y + PHYSICS.playerRadius, 6, -1);
    }
    if (groundedFrames > 0) groundedFrames--;

    // Landing particles
    const isNowGrounded = groundedFrames > 0;
    if (isNowGrounded && !wasGrounded && vel.y > 3) {
        spawnParticles(pos.x, pos.y + PHYSICS.playerRadius, 8, -1);
    }
    wasGrounded = isNowGrounded;

    // Interpolate remote players
    for (const p of Object.values(remotePlayers)) {
        p.dx += (p.x - p.dx) * 0.25;
        p.dy += (p.y - p.dy) * 0.25;
        let diff = (p.arm || 0) - p.da;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.da += diff * 0.25;
    }

    // Update remote collision bodies
    updateRemoteBodies();

    // Grab
    handleGrab();
    applyGrabForces();

    // Particles
    updateParticles();

    // Physics step
    Engine.update(engine, 1000 / 60);

    // Respawn if out of bounds
    if (pos.y > WORLD.height + 100 || pos.x < -100 || pos.x > WORLD.width + 100) {
        Body.setPosition(localBody, { x: WORLD.width / 2, y: WORLD.height - 80 });
        Body.setVelocity(localBody, { x: 0, y: 0 });
        grabTarget = null;
    }

    // Camera
    updateCamera();

    // Sync
    syncOut();

    clickedThisFrame = false;
}

// ============================================
// Grab Mechanic (arm-based)
// ============================================
function handleGrab() {
    if (!clickedThisFrame) return;

    // Release if already grabbing
    if (grabTarget) {
        grabTarget = null;
        return;
    }

    // Check if arm tips are near a remote player
    const pos = localBody.position;
    const reach = PHYSICS.playerRadius + 36; // arm length when grabbing
    const tipX = pos.x + Math.cos(armAngle) * reach;
    const tipY = pos.y + Math.sin(armAngle) * reach;

    let closest = null;
    let closestDist = PHYSICS.grabReach;

    for (const [id, p] of Object.entries(remotePlayers)) {
        const dx = p.dx - tipX;
        const dy = p.dy - tipY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < closestDist) {
            closest = id;
            closestDist = d;
        }
    }
    if (closest) grabTarget = closest;
}

function applyGrabForces() {
    // === Us grabbing someone ===
    // We hold them with our arms - slight pull so we don't drift apart
    if (grabTarget) {
        const t = remotePlayers[grabTarget];
        if (!t) { grabTarget = null; return; }

        const pos = localBody.position;
        const dx = t.dx - pos.x;
        const dy = t.dy - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Break if too far
        if (dist > PHYSICS.grabBreakDist) {
            grabTarget = null;
        }
    }

    // === Someone grabbing us with their arms ===
    // Their arm tip (gx, gy) is where they're holding us - drag us toward it
    for (const [id, p] of Object.entries(remotePlayers)) {
        if (p.grab === userId && p.gx != null && p.gy != null) {
            const pos = localBody.position;
            const dx = p.gx - pos.x;
            const dy = p.gy - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 5) {
                // Drag force: scales with distance, capped so it feels heavy
                const f = Math.min(PHYSICS.grabDragForce * dist, PHYSICS.grabMaxForce);
                Body.applyForce(localBody, pos, {
                    x: f * dx / dist,
                    y: f * dy / dist
                });
            }
        }
    }
}

function updateCamera() {
    const vw = canvas.width / scale;
    const vh = canvas.height / scale;

    const tx = localBody.position.x - vw / 2;
    const ty = localBody.position.y - vh / 2;

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
            x, y,
            vx: (Math.random() - 0.5) * 4,
            vy: yDir * Math.random() * 3.5,
            life: 1,
            decay: 0.025 + Math.random() * 0.02,
            size: 2 + Math.random() * 3
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

// ============================================
// Rendering
// ============================================
function render() {
    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-camera.x, -camera.y);

    drawGrid();
    drawPlatforms();
    drawParticles();

    // Remote players
    for (const [id, p] of Object.entries(remotePlayers)) {
        const isBeingGrabbed = isPlayerGrabbed(id);
        drawCharacter(p.dx, p.dy, p.color, p.name, p.da, p.grab != null, isBeingGrabbed, null);
    }

    // Local player - draw with grab target info so arms reach toward them
    const grabPos = getGrabTargetPos();
    const isLocalGrabbed = isPlayerGrabbed(userId);
    drawCharacter(
        localBody.position.x, localBody.position.y,
        userColor, username, armAngle,
        grabTarget != null, isLocalGrabbed, grabPos
    );

    ctx.restore();
}

// Check if a player is being grabbed by anyone
function isPlayerGrabbed(playerId) {
    if (grabTarget === playerId) return true;
    for (const p of Object.values(remotePlayers)) {
        if (p.grab === playerId) return true;
    }
    return false;
}

// Get the position of the player we're grabbing (for arm rendering)
function getGrabTargetPos() {
    if (!grabTarget || !remotePlayers[grabTarget]) return null;
    const t = remotePlayers[grabTarget];
    return { x: t.dx, y: t.dy };
}

function drawGrid() {
    const size = 100;
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;

    const vw = canvas.width / scale;
    const vh = canvas.height / scale;
    const sx = Math.floor(camera.x / size) * size;
    const sy = Math.floor(camera.y / size) * size;

    ctx.beginPath();
    for (let x = sx; x < camera.x + vw + size; x += size) {
        ctx.moveTo(x, sy);
        ctx.lineTo(x, sy + vh + size);
    }
    for (let y = sy; y < camera.y + vh + size; y += size) {
        ctx.moveTo(sx, y);
        ctx.lineTo(sx + vw + size, y);
    }
    ctx.stroke();
}

function drawPlatforms() {
    const vw = canvas.width / scale;
    const vh = canvas.height / scale;

    for (const p of platforms) {
        if (p.x + p.w / 2 < camera.x - 50 || p.x - p.w / 2 > camera.x + vw + 50) continue;
        if (p.y + p.h / 2 < camera.y - 50 || p.y - p.h / 2 > camera.y + vh + 50) continue;

        const left = p.x - p.w / 2;
        const top = p.y - p.h / 2;

        ctx.fillStyle = '#1e1e3a';
        ctx.fillRect(left, top, p.w, p.h);

        ctx.fillStyle = '#3a3a6a';
        ctx.fillRect(left, top, p.w, 3);

        ctx.strokeStyle = '#2e2e5a';
        ctx.lineWidth = 1;
        ctx.strokeRect(left, top, p.w, p.h);
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life * 0.6;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawCharacter(x, y, color, name, angle, isGrabbing, isBeingGrabbed, grabTargetPos) {
    const R = PHYSICS.playerRadius;

    // Grabbed glow
    if (isBeingGrabbed) {
        ctx.beginPath();
        ctx.arc(x, y, R + 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 100, 100, 0.15)';
        ctx.fill();
    }

    // Arms (behind body)
    drawArms(x, y, R, color, angle, isGrabbing, grabTargetPos);

    // Body circle
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = darken(color, 0.35);
    ctx.lineWidth = 3;
    ctx.stroke();

    // Grabbed indicator ring
    if (isBeingGrabbed) {
        ctx.beginPath();
        ctx.arc(x, y, R + 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Eyes
    const eSpacing = 8;
    const eY = y - 4;
    const lookAngle = isGrabbing && grabTargetPos
        ? Math.atan2(grabTargetPos.y - y, grabTargetPos.x - x)
        : angle;

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - eSpacing, eY, 5.5, 0, Math.PI * 2);
    ctx.arc(x + eSpacing, eY, 5.5, 0, Math.PI * 2);
    ctx.fill();

    const pd = 2.5;
    const px = Math.cos(lookAngle) * pd;
    const py = Math.sin(lookAngle) * pd;

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x - eSpacing + px, eY + py, 2.8, 0, Math.PI * 2);
    ctx.arc(x + eSpacing + px, eY + py, 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Mouth - strain face when grabbing, smile otherwise
    ctx.beginPath();
    if (isGrabbing) {
        // Determined/strain face
        ctx.arc(x, y + 7, 4, 0, Math.PI);
    } else if (isBeingGrabbed) {
        // Surprised face
        ctx.arc(x, y + 7, 4, 0, Math.PI * 2);
    } else {
        // Normal smile
        ctx.arc(x, y + 6, 5, 0.15, Math.PI - 0.15);
    }
    ctx.strokeStyle = darken(color, 0.45);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Name tag
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 3;
    ctx.fillText(name, x, y - R - 14);
    ctx.shadowBlur = 0;
}

function drawArms(x, y, R, color, angle, isGrabbing, grabTargetPos) {
    const dark = darken(color, 0.35);

    if (isGrabbing && grabTargetPos) {
        // Arms reach toward the grabbed player
        const grabAngle = Math.atan2(grabTargetPos.y - y, grabTargetPos.x - x);
        const dx = grabTargetPos.x - x;
        const dy = grabTargetPos.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Arms stretch toward target, max extension = dist to target clamped
        const reach = Math.min(dist, R + 45);
        const spread = 0.25;

        const angles = [grabAngle - spread, grabAngle + spread];
        for (const a of angles) {
            const sx = x + Math.cos(a) * R * 0.4;
            const sy = y + Math.sin(a) * R * 0.4;
            const hx = x + Math.cos(a) * reach;
            const hy = y + Math.sin(a) * reach;

            // Arm
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(hx, hy);
            ctx.strokeStyle = dark;
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Hand (closed fist when grabbing = slightly smaller)
            ctx.beginPath();
            ctx.arc(hx, hy, 5.5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = dark;
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }
    } else {
        // Normal arms following aim angle
        const len = 26;
        const spread = 0.35;
        const angles = [angle - spread, angle + spread];

        for (const a of angles) {
            const sx = x + Math.cos(a) * R * 0.4;
            const sy = y + Math.sin(a) * R * 0.4;
            const hx = x + Math.cos(a) * (R + len);
            const hy = y + Math.sin(a) * (R + len);

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(hx, hy);
            ctx.strokeStyle = dark;
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(hx, hy, 6.5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = dark;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}

// ============================================
// Game Loop
// ============================================
function loop() {
    update();
    render();
    requestAnimationFrame(loop);
}

// ============================================
// Boot
// ============================================
initFirebase();

document.getElementById('join-btn').addEventListener('click', joinGame);
document.getElementById('username-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinGame();
});
