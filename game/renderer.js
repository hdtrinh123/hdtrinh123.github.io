// ============================================
// Rendering
// ============================================

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

function isGrabbed(playerId) {
    if (grabTarget === playerId) return true;
    for (const p of Object.values(remotePlayers)) {
        if (p.grab === playerId) return true;
    }
    return false;
}

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
        const head = getHeadPos(p.dx, p.dy, p.grab);
        const beakClosed = p.grab != null;
        drawBird(
            p.dx, p.dy, head.x, head.y, p.dha,
            legs.l1x, legs.l1y, legs.l2x, legs.l2y,
            p.color, p.name, beakClosed, isGrabbed(id)
        );
    }

    // Local player
    const legs = getLegPositions(pBody.position.x, pBody.position.y, walkCycle);
    const head = getHeadPos(pBody.position.x, pBody.position.y, grabTarget);
    const localBeakClosed = grabTarget != null || beakCloseTimer > 0;
    drawBird(
        pBody.position.x, pBody.position.y,
        head.x, head.y, headAngle,
        legs.l1x, legs.l1y, legs.l2x, legs.l2y,
        userColor, username, localBeakClosed, isGrabbed(userId)
    );

    ctx.restore();
}

function drawGrabLines() {
    // Our grab line
    if (grabTarget && remotePlayers[grabTarget]) {
        const t = remotePlayers[grabTarget];
        const head = getHeadPos(pBody.position.x, pBody.position.y, grabTarget);
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
    // Others' grab lines
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
