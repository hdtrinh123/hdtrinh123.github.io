// Game State
let db;
let userId;
let username;
let userColor;
let inventory = { stone: 0, wood: 0, metal: 0, crystal: 0 };
let camera = { x: 0, y: 0 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let cameraStart = { x: 0, y: 0 };
let otherPlayers = {};
let materials = {};
let lastCursorUpdate = 0;

// Canvas setup
const canvas = document.getElementById('world-canvas');
const ctx = canvas.getContext('2d');

// Generate random color for player
function generateColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
        '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Generate or retrieve user ID
function getUserId() {
    let id = localStorage.getItem('multiplayer_userId');
    if (!id) {
        id = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('multiplayer_userId', id);
    }
    return id;
}

// Initialize Firebase
function initFirebase() {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

// Join the game
function joinGame() {
    const input = document.getElementById('username-input');
    username = input.value.trim() || 'Player' + Math.floor(Math.random() * 1000);
    userId = getUserId();
    userColor = generateColor();

    // Show game screen
    document.getElementById('join-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('player-name').textContent = username;

    // Center camera
    camera.x = WORLD_CONFIG.width / 2 - canvas.width / 2;
    camera.y = WORLD_CONFIG.height / 2 - canvas.height / 2;

    // Initialize
    resizeCanvas();
    setupListeners();
    loadInventory();
    setupRealtimeListeners();
    registerPresence();
    initializeMaterials();

    // Start game loop
    requestAnimationFrame(gameLoop);
}

// Resize canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 50;
}

// Setup event listeners
function setupListeners() {
    window.addEventListener('resize', resizeCanvas);

    // Mouse events
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('click', onClick);

    // Touch events
    canvas.addEventListener('touchstart', onTouchStart);
    canvas.addEventListener('touchmove', onTouchMove);
    canvas.addEventListener('touchend', onTouchEnd);

    // Inventory toggle
    document.getElementById('inventory-toggle').addEventListener('click', () => {
        document.getElementById('inventory-panel').classList.toggle('hidden');
    });
}

// Mouse handlers
function onMouseDown(e) {
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
    cameraStart = { x: camera.x, y: camera.y };
    canvas.style.cursor = 'grabbing';
}

function onMouseMove(e) {
    // Update cursor position for other players
    const now = Date.now();
    if (now - lastCursorUpdate > WORLD_CONFIG.cursorUpdateRate) {
        const worldX = e.clientX + camera.x;
        const worldY = e.clientY - 50 + camera.y;
        updateCursorPosition(worldX, worldY);
        lastCursorUpdate = now;
    }

    // Pan camera
    if (isDragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        camera.x = cameraStart.x - dx;
        camera.y = cameraStart.y - dy;
        clampCamera();
    }
}

function onMouseUp() {
    isDragging = false;
    canvas.style.cursor = 'crosshair';
}

function onClick(e) {
    if (isDragging) return;

    const worldX = e.clientX + camera.x;
    const worldY = e.clientY - 50 + camera.y;

    // Check material collision
    for (const [id, mat] of Object.entries(materials)) {
        if (!mat || mat.collected) continue;

        const dx = worldX - mat.x;
        const dy = worldY - mat.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 25) {
            collectMaterial(id, mat);
            break;
        }
    }
}

// Touch handlers
function onTouchStart(e) {
    const touch = e.touches[0];
    isDragging = true;
    dragStart = { x: touch.clientX, y: touch.clientY };
    cameraStart = { x: camera.x, y: camera.y };
}

function onTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];

    if (isDragging) {
        const dx = touch.clientX - dragStart.x;
        const dy = touch.clientY - dragStart.y;
        camera.x = cameraStart.x - dx;
        camera.y = cameraStart.y - dy;
        clampCamera();
    }
}

function onTouchEnd(e) {
    // Detect tap (short touch without much movement)
    if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const dx = Math.abs(touch.clientX - dragStart.x);
        const dy = Math.abs(touch.clientY - dragStart.y);

        if (dx < 10 && dy < 10) {
            const worldX = touch.clientX + camera.x;
            const worldY = touch.clientY - 50 + camera.y;

            for (const [id, mat] of Object.entries(materials)) {
                if (!mat || mat.collected) continue;

                const matDx = worldX - mat.x;
                const matDy = worldY - mat.y;
                const dist = Math.sqrt(matDx * matDx + matDy * matDy);

                if (dist < 35) { // Larger hit area for touch
                    collectMaterial(id, mat);
                    break;
                }
            }
        }
    }
    isDragging = false;
}

// Clamp camera to world bounds
function clampCamera() {
    camera.x = Math.max(0, Math.min(WORLD_CONFIG.width - canvas.width, camera.x));
    camera.y = Math.max(0, Math.min(WORLD_CONFIG.height - canvas.height, camera.y));
}

// Update cursor position in Firebase
function updateCursorPosition(x, y) {
    if (!db || !userId) return;

    db.ref('players/' + userId).update({
        x: x,
        y: y,
        name: username,
        color: userColor,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
}

// Register presence (online/offline)
function registerPresence() {
    const playerRef = db.ref('players/' + userId);
    const connectedRef = db.ref('.info/connected');

    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            playerRef.onDisconnect().remove();
            playerRef.set({
                name: username,
                color: userColor,
                x: WORLD_CONFIG.width / 2,
                y: WORLD_CONFIG.height / 2,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
        }
    });
}

// Setup realtime listeners
function setupRealtimeListeners() {
    // Listen for other players
    db.ref('players').on('value', (snap) => {
        const data = snap.val() || {};
        let count = 0;

        otherPlayers = {};
        for (const [id, player] of Object.entries(data)) {
            if (id !== userId) {
                otherPlayers[id] = player;
            }
            count++;
        }

        document.getElementById('player-count').textContent = count;
    });

    // Listen for materials
    db.ref('materials').on('value', (snap) => {
        materials = snap.val() || {};
    });
}

// Load inventory from Firebase
function loadInventory() {
    db.ref('inventories/' + userId).once('value', (snap) => {
        const data = snap.val();
        if (data) {
            inventory = { ...inventory, ...data };
            updateInventoryUI();
        }
    });
}

// Save inventory to Firebase
function saveInventory() {
    db.ref('inventories/' + userId).set(inventory);
}

// Update inventory UI
function updateInventoryUI() {
    document.getElementById('inv-stone').textContent = inventory.stone;
    document.getElementById('inv-wood').textContent = inventory.wood;
    document.getElementById('inv-metal').textContent = inventory.metal;
    document.getElementById('inv-crystal').textContent = inventory.crystal;
}

// Initialize materials (only if world is empty)
function initializeMaterials() {
    db.ref('materials').once('value', (snap) => {
        const existing = snap.val();

        // If no materials exist, generate them
        if (!existing || Object.keys(existing).length < WORLD_CONFIG.materialCount / 2) {
            generateMaterials();
        }
    });

    // Periodically check and respawn materials
    setInterval(checkRespawnMaterials, 5000);
}

// Generate materials
function generateMaterials() {
    const updates = {};

    for (let i = 0; i < WORLD_CONFIG.materialCount; i++) {
        const type = getRandomMaterialType();
        const id = 'mat_' + Math.random().toString(36).substr(2, 9);

        updates[id] = {
            type: type.type,
            color: type.color,
            x: 100 + Math.random() * (WORLD_CONFIG.width - 200),
            y: 100 + Math.random() * (WORLD_CONFIG.height - 200),
            collected: false
        };
    }

    db.ref('materials').update(updates);
}

// Get random material type based on weights
function getRandomMaterialType() {
    const totalWeight = MATERIAL_TYPES.reduce((sum, m) => sum + m.weight, 0);
    let random = Math.random() * totalWeight;

    for (const mat of MATERIAL_TYPES) {
        random -= mat.weight;
        if (random <= 0) return mat;
    }

    return MATERIAL_TYPES[0];
}

// Check and respawn materials
function checkRespawnMaterials() {
    const now = Date.now();
    const updates = {};
    let activeCount = 0;

    for (const [id, mat] of Object.entries(materials)) {
        if (!mat) continue;

        if (!mat.collected) {
            activeCount++;
        } else if (mat.collectedAt && now - mat.collectedAt > WORLD_CONFIG.respawnTime) {
            // Respawn this material
            updates[id] = {
                ...mat,
                collected: false,
                collectedAt: null
            };
        }
    }

    // If too few materials, add more
    if (activeCount < WORLD_CONFIG.materialCount / 3) {
        for (let i = 0; i < 5; i++) {
            const type = getRandomMaterialType();
            const id = 'mat_' + Math.random().toString(36).substr(2, 9);

            updates[id] = {
                type: type.type,
                color: type.color,
                x: 100 + Math.random() * (WORLD_CONFIG.width - 200),
                y: 100 + Math.random() * (WORLD_CONFIG.height - 200),
                collected: false
            };
        }
    }

    if (Object.keys(updates).length > 0) {
        db.ref('materials').update(updates);
    }
}

// Collect a material
function collectMaterial(id, mat) {
    // Mark as collected in Firebase
    db.ref('materials/' + id).update({
        collected: true,
        collectedAt: Date.now(),
        collectedBy: userId
    });

    // Update local inventory
    inventory[mat.type] = (inventory[mat.type] || 0) + 1;
    updateInventoryUI();
    saveInventory();

    // Show popup
    showCollectPopup(mat.type);
}

// Show collection popup
function showCollectPopup(type) {
    const popup = document.getElementById('collect-popup');
    document.getElementById('collect-type').textContent = type;
    popup.classList.remove('hidden');

    // Reset animation
    popup.style.animation = 'none';
    popup.offsetHeight; // Trigger reflow
    popup.style.animation = null;

    setTimeout(() => {
        popup.classList.add('hidden');
    }, 500);
}

// Game loop
function gameLoop() {
    render();
    requestAnimationFrame(gameLoop);
}

// Render the game
function render() {
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid();

    // Draw world boundary
    drawBoundary();

    // Draw materials
    drawMaterials();

    // Draw other players' cursors
    drawOtherPlayers();
}

// Draw background grid
function drawGrid() {
    const gridSize = 50;
    ctx.strokeStyle = '#2a2a4e';
    ctx.lineWidth = 1;

    const startX = -(camera.x % gridSize);
    const startY = -(camera.y % gridSize);

    ctx.beginPath();
    for (let x = startX; x < canvas.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    for (let y = startY; y < canvas.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
}

// Draw world boundary
function drawBoundary() {
    ctx.strokeStyle = '#4a4a6e';
    ctx.lineWidth = 3;
    ctx.strokeRect(
        -camera.x,
        -camera.y,
        WORLD_CONFIG.width,
        WORLD_CONFIG.height
    );
}

// Draw materials
function drawMaterials() {
    for (const [id, mat] of Object.entries(materials)) {
        if (!mat || mat.collected) continue;

        const screenX = mat.x - camera.x;
        const screenY = mat.y - camera.y;

        // Skip if off screen
        if (screenX < -30 || screenX > canvas.width + 30 ||
            screenY < -30 || screenY > canvas.height + 30) continue;

        // Draw glow
        const gradient = ctx.createRadialGradient(
            screenX, screenY, 0,
            screenX, screenY, 30
        );
        gradient.addColorStop(0, mat.color + '40');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(screenX - 30, screenY - 30, 60, 60);

        // Draw material
        ctx.fillStyle = mat.color;
        ctx.beginPath();

        if (mat.type === 'crystal') {
            // Diamond shape for crystal
            ctx.moveTo(screenX, screenY - 15);
            ctx.lineTo(screenX + 12, screenY);
            ctx.lineTo(screenX, screenY + 15);
            ctx.lineTo(screenX - 12, screenY);
        } else if (mat.type === 'wood') {
            // Rectangle for wood
            ctx.roundRect(screenX - 10, screenY - 8, 20, 16, 3);
        } else {
            // Circle for stone/metal
            ctx.arc(screenX, screenY, 12, 0, Math.PI * 2);
        }

        ctx.fill();

        // Add shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(screenX - 4, screenY - 4, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Draw other players
function drawOtherPlayers() {
    for (const [id, player] of Object.entries(otherPlayers)) {
        if (!player) continue;

        const screenX = player.x - camera.x;
        const screenY = player.y - camera.y;

        // Skip if off screen
        if (screenX < -50 || screenX > canvas.width + 50 ||
            screenY < -50 || screenY > canvas.height + 50) continue;

        // Draw cursor
        ctx.save();
        ctx.translate(screenX, screenY);

        // Cursor shape
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 20);
        ctx.lineTo(5, 15);
        ctx.lineTo(10, 22);
        ctx.lineTo(13, 20);
        ctx.lineTo(8, 13);
        ctx.lineTo(14, 10);
        ctx.closePath();
        ctx.fill();

        // Outline
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();

        // Draw name
        ctx.fillStyle = player.color;
        ctx.font = '12px sans-serif';
        ctx.fillText(player.name, screenX + 16, screenY + 12);
    }
}

// Initialize
initFirebase();

// Join button
document.getElementById('join-btn').addEventListener('click', joinGame);
document.getElementById('username-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinGame();
});
