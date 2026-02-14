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
        const hx = pBody.position.x;
        const hy = pBody.position.y - 22;
        gx = Math.round(hx + Math.cos(headAngle) * (RAG.head + RAG.beakLen));
        gy = Math.round(hy + Math.sin(headAngle) * (RAG.head + RAG.beakLen));
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
// Visual position helpers
// ============================================
function getHeadPos(bx, by) {
    return { x: bx, y: by - 22 };
}

function getLegPositions(bx, by, phase) {
    const swing = Math.sin(phase) * 10;
    const lift1 = Math.max(0, -Math.sin(phase)) * 5;
    const lift2 = Math.max(0, Math.sin(phase)) * 5;
    return {
        l1x: bx - 7 + swing,
        l1y: by + 20 - lift1,
        l2x: bx + 7 - swing,
        l2y: by + 20 - lift2,
    };
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

    // Walk cycle based on horizontal speed
    const speed = Math.abs(vel.x);
    if (speed > 0.3) {
        walkCycle += speed * 0.18;
    }

    // Head angle: face mouse normally, face grab target when grabbing
    if (grabTarget && remotePlayers[grabTarget]) {
        const t = remotePlayers[grabTarget];
        headAngle = Math.atan2(t.dy - (pos.y - 22), t.dx - pos.x);
    } else {
        headAngle = Math.atan2(mouseWorld.y - (pos.y - 22), mouseWorld.x - pos.x);
    }

    if (beakCloseTimer > 0) beakCloseTimer--;

    // Interpolate remote players
    const lerp = 0.25;
    for (const p of Object.values(remotePlayers)) {
        p.prevDx = p.dx;
        p.dx += (p.x - p.dx) * lerp;
        p.dy += (p.y - p.dy) * lerp;
        // Angle interpolation
        let adiff = (p.ha || 0) - p.dha;
        while (adiff > Math.PI) adiff -= Math.PI * 2;
        while (adiff < -Math.PI) adiff += Math.PI * 2;
        p.dha += adiff * lerp;
        // Walk phase from velocity
        const remoteVx = p.dx - p.prevDx;
        if (Math.abs(remoteVx) > 0.3) {
            p.walkPhase += Math.abs(remoteVx) * 0.6;
        }
    }

    updateRemoteBodies();
    handleGrab();
    applyGrabForces();
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

// ============================================
// Grab (beak-based)
// ============================================
function handleGrab() {
    if (!clickedThisFrame) return;
    beakCloseTimer = 12;

    if (grabTarget) { grabTarget = null; return; }

    const head = getHeadPos(pBody.position.x, pBody.position.y);
    const tipX = head.x + Math.cos(headAngle) * (RAG.head + RAG.beakLen);
    const tipY = head.y + Math.sin(headAngle) * (RAG.head + RAG.beakLen);

    let closest = null, closestD = PHYSICS.grabReach;
    for (const [id, p] of Object.entries(remotePlayers)) {
        const dx = p.dx - tipX, dy = p.dy - tipY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < closestD) { closest = id; closestD = d; }
    }
    if (closest) grabTarget = closest;
}

function applyGrabForces() {
    if (grabTarget) {
        const t = remotePlayers[grabTarget];
        if (!t) { grabTarget = null; return; }
        const head = getHeadPos(pBody.position.x, pBody.position.y);
        const tipX = head.x + Math.cos(headAngle) * (RAG.head + RAG.beakLen);
        const tipY = head.y + Math.sin(headAngle) * (RAG.head + RAG.beakLen);
        const dx = t.dx - tipX, dy = t.dy - tipY;
        if (Math.sqrt(dx * dx + dy * dy) > PHYSICS.grabBreakDist) grabTarget = null;
    }

    // Someone grabbing us: drag toward their beak tip
    for (const [id, p] of Object.entries(remotePlayers)) {
        if (p.grab === userId && p.gx != null && p.gy != null) {
            const dx = p.gx - pBody.position.x;
            const dy = p.gy - pBody.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 5) {
                const f = Math.min(PHYSICS.grabDragForce * dist, PHYSICS.grabMaxForce);
                Body.applyForce(pBody, pBody.position, { x: f * dx / dist, y: f * dy / dist });
            }
        }
    }
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
    drawGrabLines();

    // Remote players
    for (const [id, p] of Object.entries(remotePlayers)) {
        const legs = getLegPositions(p.dx, p.dy, p.walkPhase || 0);
        const head = getHeadPos(p.dx, p.dy);
        const beakClosed = p.grab != null;
        drawBird(
            p.dx, p.dy, head.x, head.y, p.dha,
            legs.l1x, legs.l1y, legs.l2x, legs.l2y,
            p.color, p.name, beakClosed, isGrabbed(id)
        );
    }

    // Local player
    const legs = getLegPositions(pBody.position.x, pBody.position.y, walkCycle);
    const head = getHeadPos(pBody.position.x, pBody.position.y);
    const localBeakClosed = grabTarget != null || beakCloseTimer > 0;
    drawBird(
        pBody.position.x, pBody.position.y,
        head.x, head.y, headAngle,
        legs.l1x, legs.l1y, legs.l2x, legs.l2y,
        userColor, username, localBeakClosed, isGrabbed(userId)
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

function drawGrabLines() {
    if (grabTarget && remotePlayers[grabTarget]) {
        const t = remotePlayers[grabTarget];
        const head = getHeadPos(pBody.position.x, pBody.position.y);
        const tipX = head.x + Math.cos(headAngle) * (RAG.head + RAG.beakLen);
        const tipY = head.y + Math.sin(headAngle) * (RAG.head + RAG.beakLen);
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(t.dx, t.dy);
        ctx.strokeStyle = 'rgba(255,150,50,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
    }
    for (const p of Object.values(remotePlayers)) {
        if (p.grab && p.gx != null && p.gy != null) {
            const target = p.grab === userId ? pBody.position : (remotePlayers[p.grab] || null);
            if (target) {
                const tx = p.grab === userId ? target.x : target.dx;
                const ty = p.grab === userId ? target.y : target.dy;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(p.gx, p.gy);
                ctx.lineTo(tx, ty);
                ctx.strokeStyle = 'rgba(255,150,50,0.3)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }
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

function drawBird(tx, ty, hx, hy, ha, l1x, l1y, l2x, l2y, color, name, beakClosed, beingGrabbed) {
    const dk = darken(color, 0.35);

    if (beingGrabbed) {
        ctx.beginPath(); ctx.arc(tx, ty, 28, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,100,100,0.12)'; ctx.fill();
    }

    // === Legs (behind torso) ===
    ctx.beginPath();
    ctx.moveTo(tx - 5, ty + 10);
    ctx.lineTo(l1x, l1y);
    ctx.strokeStyle = '#E8A030'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(l1x, l1y, RAG.leg, 0, Math.PI * 2);
    ctx.fillStyle = '#F0B040'; ctx.fill();
    ctx.strokeStyle = '#C88020'; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tx + 5, ty + 10);
    ctx.lineTo(l2x, l2y);
    ctx.strokeStyle = '#E8A030'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(l2x, l2y, RAG.leg, 0, Math.PI * 2);
    ctx.fillStyle = '#F0B040'; ctx.fill();
    ctx.strokeStyle = '#C88020'; ctx.lineWidth = 1.5; ctx.stroke();

    // === Torso ===
    ctx.beginPath(); ctx.arc(tx, ty, RAG.torso, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = 3; ctx.stroke();

    if (beingGrabbed) {
        ctx.beginPath(); ctx.arc(tx, ty, RAG.torso + 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,100,100,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    }

    // === Neck ===
    ctx.beginPath();
    ctx.moveTo(tx, ty - 10);
    ctx.lineTo(hx, hy + 8);
    ctx.strokeStyle = dk; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();

    // === Beak (behind head so head overlaps base) ===
    drawBeak(hx, hy, ha, RAG.head, beakClosed);

    // === Head ===
    ctx.beginPath(); ctx.arc(hx, hy, RAG.head, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = 2.5; ctx.stroke();

    // === Eyes ===
    const eyeOffset = RAG.head * 0.25;
    const eyeSpread = RAG.head * 0.38;
    const perp = ha + Math.PI / 2;
    const ecx = hx + Math.cos(ha) * eyeOffset;
    const ecy = hy + Math.sin(ha) * eyeOffset;
    const le_x = ecx + Math.cos(perp) * eyeSpread;
    const le_y = ecy + Math.sin(perp) * eyeSpread;
    const re_x = ecx - Math.cos(perp) * eyeSpread;
    const re_y = ecy - Math.sin(perp) * eyeSpread;

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(le_x, le_y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(re_x, re_y, 3.5, 0, Math.PI * 2); ctx.fill();
    const pd = 1.5;
    const ppx = Math.cos(ha) * pd, ppy = Math.sin(ha) * pd;
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(le_x + ppx, le_y + ppy, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(re_x + ppx, re_y + ppy, 1.8, 0, Math.PI * 2); ctx.fill();

    // === Name ===
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;
    ctx.fillText(name, hx, hy - RAG.head - 10);
    ctx.shadowBlur = 0;
}

function drawBeak(hx, hy, angle, r, closed) {
    const len = RAG.beakLen;
    const spread = closed ? 0.03 : 0.25;
    const baseW = 5;
    const perp = angle + Math.PI / 2;

    const bx = hx + Math.cos(angle) * (r - 2);
    const by = hy + Math.sin(angle) * (r - 2);

    const uTipX = hx + Math.cos(angle - spread) * (r + len);
    const uTipY = hy + Math.sin(angle - spread) * (r + len);
    const uBaseX = bx + Math.cos(perp) * baseW;
    const uBaseY = by + Math.sin(perp) * baseW;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(uBaseX, uBaseY);
    ctx.lineTo(uTipX, uTipY);
    ctx.closePath();
    ctx.fillStyle = '#FF9800'; ctx.fill();
    ctx.strokeStyle = '#E65100'; ctx.lineWidth = 1; ctx.stroke();

    const lTipX = hx + Math.cos(angle + spread) * (r + len);
    const lTipY = hy + Math.sin(angle + spread) * (r + len);
    const lBaseX = bx - Math.cos(perp) * baseW;
    const lBaseY = by - Math.sin(perp) * baseW;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(lBaseX, lBaseY);
    ctx.lineTo(lTipX, lTipY);
    ctx.closePath();
    ctx.fillStyle = '#FB8C00'; ctx.fill();
    ctx.strokeStyle = '#E65100'; ctx.lineWidth = 1; ctx.stroke();
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
