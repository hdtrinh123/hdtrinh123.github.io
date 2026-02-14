// ============================================
// Grab & Head Mechanics
// ============================================

// Look up a grab target's display position
function getGrabTargetPos(targetId) {
    if (!targetId) return null;
    if (targetId === userId) return { x: pBody.position.x, y: pBody.position.y };
    const p = remotePlayers[targetId];
    return p ? { x: p.dx, y: p.dy } : null;
}

// Head position: base at (bx, by-22), pulled toward grab target by weight
function getHeadPos(bx, by, grabId) {
    let hx = bx, hy = by - 22;
    const target = getGrabTargetPos(grabId);
    if (target) {
        const dx = target.x - hx;
        const dy = target.y - hy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
            // Head gets dragged toward grab target (weight pull)
            // Max 8px offset so it doesn't detach from body
            const pull = Math.min(dist * 0.04, 8);
            hx += (dx / dist) * pull;
            hy += (dy / dist) * pull;
        }
    }
    return { x: hx, y: hy };
}

// Compute head angle: follows mouse, but grabbed object's weight pulls it back
function computeHeadState() {
    if (!pBody) return;
    const pos = pBody.position;
    const headBaseY = pos.y - 22;

    // Desired angle: always toward mouse
    const desiredAngle = Math.atan2(mouseWorld.y - headBaseY, mouseWorld.x - pos.x);

    if (grabTarget && remotePlayers[grabTarget]) {
        const t = remotePlayers[grabTarget];
        const grabAngle = Math.atan2(t.dy - headBaseY, t.dx - pos.x);

        const dx = t.dx - pos.x;
        const dy = t.dy - headBaseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Pull strength: more distance = harder to turn away from target
        // At close range (<30px) almost no pull, at far range strong pull (up to 65%)
        const pullStrength = Math.min(Math.max((dist - 30) / 120, 0), 0.65);

        // Shortest angle path
        let diff = grabAngle - desiredAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        // Blend: head tries to follow mouse but weight pulls it toward target
        headAngle = desiredAngle + diff * pullStrength;
    } else {
        headAngle = desiredAngle;
    }
}

// Handle grab click: toggle grab on/off
function handleGrab() {
    if (!clickedThisFrame) return;
    beakCloseTimer = 12;

    if (grabTarget) { grabTarget = null; return; }

    // Use base head pos (no pull when not yet grabbing)
    const head = getHeadPos(pBody.position.x, pBody.position.y, null);
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

// Apply grab forces with Newton's 3rd law (equal & opposite)
function applyGrabForces() {
    // === Forces on us as the GRABBER (reaction force) ===
    // When we hold someone, the "rope" from beak to target pulls us too.
    // If we aim up and they're below, we get pulled DOWN. (can't lift for free)
    if (grabTarget) {
        const t = remotePlayers[grabTarget];
        if (!t) { grabTarget = null; return; }

        const head = getHeadPos(pBody.position.x, pBody.position.y, grabTarget);
        const tipX = head.x + Math.cos(headAngle) * (RAG.head + RAG.beakLen);
        const tipY = head.y + Math.sin(headAngle) * (RAG.head + RAG.beakLen);

        // Vector from beak tip to grabbed player
        const dx = t.dx - tipX;
        const dy = t.dy - tipY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > PHYSICS.grabBreakDist) {
            grabTarget = null;
        } else if (dist > 5) {
            // Reaction force: beak tip is pulled toward grabbed player,
            // transmitted through head/neck to our body.
            const f = Math.min(PHYSICS.grabDragForce * dist, PHYSICS.grabMaxForce);
            Body.applyForce(pBody, pBody.position, {
                x: f * dx / dist,
                y: f * dy / dist
            });
        }
    }

    // === Forces on us when BEING GRABBED ===
    // The other player's beak tip pulls us toward it
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
