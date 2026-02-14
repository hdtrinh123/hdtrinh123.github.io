// ============================================
// Matter.js aliases
// ============================================
const { Engine, Bodies, Body, Composite, Constraint, Events } = Matter;

// ============================================
// State
// ============================================
let db, userId, username, userColor;
let engine, mWorld, canvas, ctx;
let scale = 1;
let camera = { x: 0, y: 0 };

// Local ragdoll
let pHead, pTorso, pArm, pLeg;
let pGroup;

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

// ============================================
// Helpers
// ============================================
function getUserId() {
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
    engine = Engine.create({ gravity: { x: 0, y: 0.9 } });
    mWorld = engine.world;
}

function buildWorld() {
    const W = WORLD.width, H = WORLD.height;
    const defs = [
        [W/2, H-20, W+100, 40],
        [-20, H/2, 40, H+100], [W+20, H/2, 40, H+100],
        [W/2, -20, W+100, 40],
        // Tier 1
        [200,1000,220,22],[550,960,180,22],[950,1000,280,22],
        [1400,960,200,22],[1800,1000,240,22],[2200,960,180,22],
        // Tier 2
        [120,810,180,22],[450,760,220,22],[850,800,200,22],
        [1200,740,260,22],[1600,780,200,22],[2000,800,220,22],[2350,740,160,22],
        // Tier 3
        [280,580,200,22],[650,530,180,22],[1050,560,200,22],
        [1400,500,240,22],[1780,540,200,22],[2150,520,200,22],
        // Tier 4
        [150,380,160,22],[500,340,200,22],[900,300,160,22],
        [1250,340,200,22],[1600,310,180,22],[2000,360,180,22],
        // Tier 5
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
// Local Ragdoll
// ============================================
function createLocalPlayer() {
    const x = WORLD.width / 2, y = WORLD.height - 100;
    pGroup = Body.nextGroup(true);
    const cf = { group: pGroup };

    pTorso = Bodies.circle(x, y, RAG.torso, {
        density: 0.003, friction: 0.5, restitution: 0.3,
        frictionAir: 0.02, collisionFilter: cf
    });
    pHead = Bodies.circle(x, y - 24, RAG.head, {
        density: 0.001, friction: 0.3, restitution: 0.4,
        frictionAir: 0.015, collisionFilter: cf
    });
    pArm = Bodies.circle(x + 25, y - 5, RAG.arm, {
        density: 0.0008, friction: 0.7, restitution: 0.2,
        frictionAir: 0.04, collisionFilter: cf
    });
    pLeg = Bodies.circle(x, y + 25, RAG.leg, {
        density: 0.0012, friction: 0.9, restitution: 0.1,
        frictionAir: 0.015, collisionFilter: cf
    });

    const neck = Constraint.create({
        bodyA: pTorso, pointA: { x: 0, y: -13 },
        bodyB: pHead, pointB: { x: 0, y: 9 },
        stiffness: 0.5, damping: 0.1, length: 3
    });
    const shoulder = Constraint.create({
        bodyA: pTorso, pointA: { x: 10, y: -5 },
        bodyB: pArm, pointB: { x: 0, y: 0 },
        stiffness: 0.12, damping: 0.05, length: 22
    });
    const hip = Constraint.create({
        bodyA: pTorso, pointA: { x: -2, y: 12 },
        bodyB: pLeg, pointB: { x: 0, y: -6 },
        stiffness: 0.25, damping: 0.08, length: 14
    });

    Composite.add(mWorld, [pTorso, pHead, pArm, pLeg, neck, shoulder, hip]);

    // Ground detection
    const myParts = new Set([pTorso, pHead, pArm, pLeg]);
    Events.on(engine, 'collisionActive', (event) => {
        for (const pair of event.pairs) {
            const a = pair.bodyA, b = pair.bodyB;
            const mine = myParts.has(a) ? a : myParts.has(b) ? b : null;
            if (!mine) continue;
            const other = mine === a ? b : a;
            if (myParts.has(other)) continue;
            if ((mine === pTorso || mine === pLeg) && other.position.y > mine.position.y) {
                groundedFrames = PHYSICS.coyoteFrames;
            }
        }
    });
}

// ============================================
// Remote Player Bodies (soft/pushable)
// ============================================
function updateRemoteBodies() {
    for (const [id, p] of Object.entries(remotePlayers)) {
        if (!remoteBodies[id]) {
            // Dynamic body so it can be pushed, but heavy
            const body = Bodies.circle(p.dx, p.dy, RAG.torso + 4, {
                density: 0.006, restitution: 0.3,
                friction: 0.4, frictionAir: 0.05,
                label: 'remote_' + id
            });
            Composite.add(mWorld, body);
            remoteBodies[id] = body;
        }
        // Spring toward synced position (soft, squishy feel)
        const body = remoteBodies[id];
        const dx = p.dx - body.position.x;
        const dy = p.dy - body.position.y;
        Body.applyForce(body, body.position, {
            x: dx * PHYSICS.remoteSpring,
            y: dy * PHYSICS.remoteSpring
        });
        // Damping
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
                x: pTorso.position.x, y: pTorso.position.y,
                hx: pHead.position.x, hy: pHead.position.y,
                ax: pArm.position.x, ay: pArm.position.y,
                lx: pLeg.position.x, ly: pLeg.position.y,
                grab: null, gx: null, gy: null,
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
                dx:  prev ? prev.dx  : p.x,  dy:  prev ? prev.dy  : p.y,
                dhx: prev ? prev.dhx : (p.hx||p.x), dhy: prev ? prev.dhy : (p.hy||p.y-24),
                dax: prev ? prev.dax : (p.ax||p.x+25), day: prev ? prev.day : (p.ay||p.y),
                dlx: prev ? prev.dlx : (p.lx||p.x), dly: prev ? prev.dly : (p.ly||p.y+25),
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
    if (!pTorso || !db) return;

    let gx = null, gy = null;
    if (grabTarget) {
        gx = Math.round(pArm.position.x);
        gy = Math.round(pArm.position.y);
    }
    db.ref('players/' + userId).update({
        x:  Math.round(pTorso.position.x), y:  Math.round(pTorso.position.y),
        hx: Math.round(pHead.position.x),  hy: Math.round(pHead.position.y),
        ax: Math.round(pArm.position.x),   ay: Math.round(pArm.position.y),
        lx: Math.round(pLeg.position.x),   ly: Math.round(pLeg.position.y),
        grab: grabTarget || null, gx: gx, gy: gy,
        t: firebase.database.ServerValue.TIMESTAMP
    });
}

// ============================================
// Game Logic
// ============================================
function update() {
    if (!pTorso) return;
    const pos = pTorso.position;
    const vel = pTorso.velocity;

    // Movement (applied to torso)
    const left  = keys['a'] || keys['arrowleft']  || keys['_touchL'];
    const right = keys['d'] || keys['arrowright'] || keys['_touchR'];
    const jump  = keys['w'] || keys['arrowup'] || keys[' '] || keys['_touchJ'];

    if (left)  Body.applyForce(pTorso, pos, { x: -PHYSICS.moveForce, y: 0 });
    if (right) Body.applyForce(pTorso, pos, { x:  PHYSICS.moveForce, y: 0 });

    if (Math.abs(vel.x) > PHYSICS.maxSpeed) {
        Body.setVelocity(pTorso, { x: Math.sign(vel.x) * PHYSICS.maxSpeed, y: vel.y });
    }

    if (jump && groundedFrames > 0) {
        Body.setVelocity(pTorso, { x: vel.x, y: -PHYSICS.jumpSpeed });
        groundedFrames = 0;
        spawnParticles(pos.x, pos.y + RAG.torso, 6, -1);
    }
    if (groundedFrames > 0) groundedFrames--;

    // Landing particles
    const grounded = groundedFrames > 0;
    if (grounded && !wasGrounded && vel.y > 2) {
        spawnParticles(pos.x, pos.y + RAG.torso, 8, -1);
    }
    wasGrounded = grounded;

    // Arm follows mouse (floppy, physics-based reaching)
    const aPos = pArm.position;
    const adx = mouseWorld.x - aPos.x;
    const ady = mouseWorld.y - aPos.y;
    const adist = Math.sqrt(adx * adx + ady * ady);
    if (adist > 1) {
        const f = Math.min(PHYSICS.armForce * adist, PHYSICS.armMax);
        Body.applyForce(pArm, aPos, { x: f * adx / adist, y: f * ady / adist });
    }

    // Leg swings with movement
    const legTargetX = pos.x + (left ? -12 : right ? 12 : 0);
    const legTargetY = pos.y + 28;
    const ldx = legTargetX - pLeg.position.x;
    const ldy = legTargetY - pLeg.position.y;
    Body.applyForce(pLeg, pLeg.position, { x: ldx * PHYSICS.legForce, y: ldy * PHYSICS.legForce });

    // Interpolate remote players
    const lerp = 0.25;
    for (const p of Object.values(remotePlayers)) {
        p.dx  += (p.x - p.dx) * lerp;
        p.dy  += (p.y - p.dy) * lerp;
        p.dhx += ((p.hx || p.x) - p.dhx) * lerp;
        p.dhy += ((p.hy || p.y - 24) - p.dhy) * lerp;
        p.dax += ((p.ax || p.x + 25) - p.dax) * lerp;
        p.day += ((p.ay || p.y) - p.day) * lerp;
        p.dlx += ((p.lx || p.x) - p.dlx) * lerp;
        p.dly += ((p.ly || p.y + 25) - p.dly) * lerp;
    }

    updateRemoteBodies();
    handleGrab();
    applyGrabForces();
    updateParticles();
    Engine.update(engine, 1000 / 60);

    // Respawn
    if (pos.y > WORLD.height + 100 || pos.x < -100 || pos.x > WORLD.width + 100) {
        const rx = WORLD.width / 2, ry = WORLD.height - 100;
        Body.setPosition(pTorso, { x: rx, y: ry });
        Body.setPosition(pHead, { x: rx, y: ry - 24 });
        Body.setPosition(pArm, { x: rx + 25, y: ry - 5 });
        Body.setPosition(pLeg, { x: rx, y: ry + 25 });
        [pTorso, pHead, pArm, pLeg].forEach(b => Body.setVelocity(b, { x: 0, y: 0 }));
        grabTarget = null;
    }

    updateCamera();
    syncOut();
    clickedThisFrame = false;
}

// ============================================
// Grab
// ============================================
function handleGrab() {
    if (!clickedThisFrame) return;
    if (grabTarget) { grabTarget = null; return; }

    // Check if hand is near a remote player
    const hand = pArm.position;
    let closest = null, closestD = PHYSICS.grabReach;
    for (const [id, p] of Object.entries(remotePlayers)) {
        const dx = p.dx - hand.x, dy = p.dy - hand.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < closestD) { closest = id; closestD = d; }
    }
    if (closest) grabTarget = closest;
}

function applyGrabForces() {
    // Break if target too far from hand
    if (grabTarget) {
        const t = remotePlayers[grabTarget];
        if (!t) { grabTarget = null; return; }
        const dx = t.dx - pArm.position.x, dy = t.dy - pArm.position.y;
        if (Math.sqrt(dx * dx + dy * dy) > PHYSICS.grabBreakDist) grabTarget = null;
    }

    // Someone grabbing us: drag toward their hand (gx, gy)
    for (const [id, p] of Object.entries(remotePlayers)) {
        if (p.grab === userId && p.gx != null && p.gy != null) {
            const dx = p.gx - pTorso.position.x;
            const dy = p.gy - pTorso.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 5) {
                const f = Math.min(PHYSICS.grabDragForce * dist, PHYSICS.grabMaxForce);
                Body.applyForce(pTorso, pTorso.position, { x: f * dx / dist, y: f * dy / dist });
            }
        }
    }
}

function updateCamera() {
    const vw = canvas.width / scale, vh = canvas.height / scale;
    const tx = pTorso.position.x - vw / 2;
    const ty = pTorso.position.y - vh / 2;
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
        drawRagdoll(
            p.dx, p.dy, p.dhx, p.dhy, p.dax, p.day, p.dlx, p.dly,
            p.color, p.name, p.grab != null, isGrabbed(id)
        );
    }

    // Local player
    drawRagdoll(
        pTorso.position.x, pTorso.position.y,
        pHead.position.x, pHead.position.y,
        pArm.position.x, pArm.position.y,
        pLeg.position.x, pLeg.position.y,
        userColor, username, grabTarget != null, isGrabbed(userId)
    );

    ctx.restore();
}

function isGrabbed(playerId) {
    if (grabTarget === playerId) return true;
    for (const p of Object.values(remotePlayers)) {
        if (p.grab === playerId) return true;
    }
    return false;
}

function drawGrid() {
    const size = 100;
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    const vw = canvas.width / scale, vh = canvas.height / scale;
    const sx = Math.floor(camera.x / size) * size;
    const sy = Math.floor(camera.y / size) * size;
    ctx.beginPath();
    for (let x = sx; x < camera.x + vw + size; x += size) { ctx.moveTo(x, sy); ctx.lineTo(x, sy + vh + size); }
    for (let y = sy; y < camera.y + vh + size; y += size) { ctx.moveTo(sx, y); ctx.lineTo(sx + vw + size, y); }
    ctx.stroke();
}

function drawPlatforms() {
    const vw = canvas.width / scale, vh = canvas.height / scale;
    for (const p of platforms) {
        if (p.x + p.w/2 < camera.x - 50 || p.x - p.w/2 > camera.x + vw + 50) continue;
        if (p.y + p.h/2 < camera.y - 50 || p.y - p.h/2 > camera.y + vh + 50) continue;
        const l = p.x - p.w/2, t = p.y - p.h/2;
        ctx.fillStyle = '#1e1e3a'; ctx.fillRect(l, t, p.w, p.h);
        ctx.fillStyle = '#3a3a6a'; ctx.fillRect(l, t, p.w, 3);
        ctx.strokeStyle = '#2e2e5a'; ctx.lineWidth = 1; ctx.strokeRect(l, t, p.w, p.h);
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life * 0.6;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawRagdoll(tx, ty, hx, hy, ax, ay, lx, ly, color, name, isGrabbing, isBeingGrabbed) {
    const dk = darken(color, 0.35);
    const lt = darken(color, 0.1);

    // Grab glow
    if (isBeingGrabbed) {
        ctx.beginPath(); ctx.arc(tx, ty, 28, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,100,100,0.12)'; ctx.fill();
    }

    // === Leg (behind) ===
    ctx.beginPath();
    ctx.moveTo(tx - 2, ty + 10);
    ctx.lineTo(lx, ly);
    ctx.strokeStyle = dk; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
    // Foot
    ctx.beginPath(); ctx.arc(lx, ly, RAG.leg, 0, Math.PI * 2);
    ctx.fillStyle = lt; ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = 2; ctx.stroke();

    // === Torso ===
    ctx.beginPath(); ctx.arc(tx, ty, RAG.torso, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = 3; ctx.stroke();

    // Grabbed ring
    if (isBeingGrabbed) {
        ctx.beginPath(); ctx.arc(tx, ty, RAG.torso + 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,100,100,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    }

    // === Neck ===
    ctx.beginPath();
    ctx.moveTo(tx, ty - 12);
    ctx.lineTo(hx, hy + 8);
    ctx.strokeStyle = dk; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();

    // === Head ===
    ctx.beginPath(); ctx.arc(hx, hy, RAG.head, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = 2.5; ctx.stroke();

    // Face - eyes look toward arm
    const eyeAngle = Math.atan2(ay - hy, ax - hx);
    const eS = 4.5, eY = hy - 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(hx - eS, eY, 3.5, 0, Math.PI * 2);
    ctx.arc(hx + eS, eY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    const pd = 1.5, ppx = Math.cos(eyeAngle) * pd, ppy = Math.sin(eyeAngle) * pd;
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(hx - eS + ppx, eY + ppy, 1.8, 0, Math.PI * 2);
    ctx.arc(hx + eS + ppx, eY + ppy, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.beginPath();
    if (isGrabbing) { ctx.arc(hx, hy + 4, 3, 0, Math.PI); }
    else if (isBeingGrabbed) { ctx.arc(hx, hy + 4, 3, 0, Math.PI * 2); }
    else { ctx.arc(hx, hy + 4, 3.5, 0.15, Math.PI - 0.15); }
    ctx.strokeStyle = dk; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.stroke();

    // === Arm (in front) ===
    ctx.beginPath();
    ctx.moveTo(tx + 10, ty - 5);
    ctx.lineTo(ax, ay);
    ctx.strokeStyle = dk; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
    // Hand
    ctx.beginPath(); ctx.arc(ax, ay, RAG.arm, 0, Math.PI * 2);
    ctx.fillStyle = isGrabbing ? lt : color; ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = isGrabbing ? 2.5 : 2; ctx.stroke();

    // Name
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;
    ctx.fillText(name, hx, hy - RAG.head - 8);
    ctx.shadowBlur = 0;
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
