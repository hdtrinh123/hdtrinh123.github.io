const canvas = document.getElementById('gameCanvas');
/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext('2d');
/// <reference types="mathjs" />

const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
// `held` tracks keys currently down; `pressed` tracks keys that went down this
// frame (consumed by gameplay, then cleared at the end of the loop).
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

const LEFT_KEYS = ['ArrowLeft', 'KeyA'];
const RIGHT_KEYS = ['ArrowRight', 'KeyD'];
const JUMP_KEYS = ['ArrowUp', 'KeyW', 'Space'];

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------
// Plain objects with their own state and behaviour. Every entity exposes a
// position/size and a `color`; the world iterates them for update + render.

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

    update(_dt, _world) {}

    render(context) {
        context.fillStyle = this.color;
        context.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Wall extends Entity {
    constructor(x, y, width, height) {
        super(x, y, width, height, 'darkgray');
        this.solid = true;
    }
}

class Portal extends Entity {
    constructor(x, y, width = 75, height = 10, targetX = 0, targetY = 0, rotation = 0) {
        super(x, y, width, height, 'blue');
        this.rotation = rotation;
        this.targetX = targetX;
        this.targetY = targetY;
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }

    rotIntersects(entity) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const ux = [Math.cos(this.rotation), Math.sin(this.rotation)];   // unit axis along width
        const uy = [-Math.sin(this.rotation), Math.cos(this.rotation)];  // unit axis along height
        const aabbx = [1, 0];
        const aabby = [0, 1];
        for (const axis of [ux, uy, aabbx, aabby]) {
            // Project the corners of the entity onto the axis, and check if any are within the half-extents of the portal on that axis.
            const hw = Math.abs(math.dot(ux, axis)) * this.width / 2 + Math.abs(math.dot(uy, axis)) * this.height / 2;
            const hh = Math.abs(math.dot(ux, axis)) * this.width / 2 + Math.abs(math.dot(uy, axis)) * this.height / 2;
        
            for (const corner of [
                {x: entity.x, y: entity.y},
                {x: entity.x + entity.width, y: entity.y},
                {x: entity.x, y: entity.y + entity.height},
                {x: entity.x + entity.width, y: entity.y + entity.height},
            ]) 
            {
                const w = [corner.x - cx, corner.y - cy]; // dot to project onto each axis
                if (Math.abs(math.dot(w, ux)) <= hw && Math.abs(math.dot(w, uy)) <= hh) {
                    return true;
                }
            }
        }
        return false;
    }

    update(_dt, world) {
        // Check every movable entity (anything that is not a solid wall)
        for (const entity of world.movableEntities) {
            if (entity === this) continue; // skip self
            if (this.rotIntersects(entity)) {
                console.log('touching portal:', entity.constructor.name);
                return;
            }
        }
    }

}

class Player extends Entity {
    constructor(x = 100, y = 100) {
        super(x, y, 50, 50, 'blue');
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
        this.jumpbuffer = 0; // jump within a distance of the ground
        this.coyoteTime = 0; // coyote time, in ms
        this.justjumped = false;

        // Momentum retention: physics shouldn't be entirely accurate, this
        // makes it feel smoother. If a collision cancels our speed but we leave
        // the surface again within `momentumGrace` ms, we get that speed back
        // instead of dead-stopping. Tracked per-axis. (underscore = internal)
        this.momentumGrace = 20; // ms you can stay touching a surface and still keep your speed on the way off
        this.momentum = 0;
        this.maxMomentum = 1000; // px/s, cap the speed we can retain (otherwise you can get a huge boost by falling off a wall)
        this._momentumTimerX = 0;
        this._momentumTimerY = 0;
        this._contactX = false;
        this._contactY = false;

        // Tuning (carried over from the ECS prototype).
        this.moveSpeed = 300;   // px/s horizontal target
        this.smoothing = 12;    // higher = snappier accel/decel
        this.jumpSpeed = 600;   // px/s launch
        this.jumpBufferDistance = 10; //jump within 10 pixels of the ground
        this.coyoteTimeLimit = 0.1 * 1000; // milliseconds to allow jumping after leaving a platform
        this.gravity = 1500;    // px/s^2
    }

    update(dt, world) {
        // --- horizontal: smoothly chase a target velocity ---
        let targetX = 0;
        if (input.isHeld(...LEFT_KEYS)) targetX -= this.moveSpeed;
        if (input.isHeld(...RIGHT_KEYS)) targetX += this.moveSpeed;

        const amt = 1 - Math.exp(-this.smoothing * dt);
        this.vx = lerp(this.vx, targetX, amt);
        if (Math.abs(this.vx) < 5) this.vx = 0;

        this.jumpbuffer = Math.max(0, this.jumpbuffer - dt * 1000);
        if (this.grounded) {
            this.coyoteTime = this.coyoteTimeLimit;
        } else {
            this.coyoteTime = Math.max(0, this.coyoteTime - dt * 1000);
        }
        for(let solids of world.solids){
            this.y-=10
            if(this.intersects(solids))
            this.y+=10
        }

        // --- gravity ---
        this.vy += this.gravity * dt;

        // --- move + resolve collisions one axis at a time ---
        // Stash the velocity going in so retainMomentum can hand it back if a
        // collision cancels it and we slip off again a moment later.
        const preVx = this.vx;
        this.x += this.vx * dt;
        const hitX = this.resolveAxis(world, 'x');
        this.retainMomentum('x', preVx, hitX, dt);

        const preVy = this.vy;
        this.y += this.vy * dt;
        this.grounded = false;
        let hitY = this.resolveAxis(world, 'y');

        // floor = bottom of canvas (counts as a vertical contact too)
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            this.vy = 0;
            this.grounded = true;
            hitY = true;
        }
        if (this.y + this.height + 10 > canvas.height) {
            this.grounded = true;
        }
        this.retainMomentum('y', preVy, hitY, dt);
    }

    // Keep speed through brief, glancing contact: touch a surface and slip off
    // it again within `momentumGrace` ms and we restore the velocity the
    // collision cancelled, instead of dead-stopping. The window starts on the
    // first frame of contact and keeps ticking while we stay touching — so only
    // *brief* brushes keep their speed; leaning on a wall lets the window close.
    // retainMomentum(axis, preVel, hit, dt) {
    //     const isX = axis === 'x';
    //     const stash = isX ? '_momentumX' : '_momentumY';
    //     const timer = isX ? '_momentumTimerX' : '_momentumTimerY';
    //     const wasContact = isX ? '_contactX' : '_contactY';

    //     if (hit) {
    //         if (!this[wasContact]) { // rising edge: just touched
    //             this[stash] = preVel;
    //             this[timer] = this.momentumGrace;
    //         }
    //     } else if (this[timer] > 0) { // slipped off in time: hand the speed back
    //         if (isX) this.vx = this[stash];
    //         else this.vy = this[stash];
    //         this[timer] = 0;
    //     }

    //     this[wasContact] = hit;
    //     this[timer] = Math.max(0, this[timer] - dt * 1000);
    // }


    // Push the player out of any solid it overlaps along a single axis, using
    // the sign of its velocity on that axis to decide which side. Returns true
    // if it collided with anything (used to drive momentum retention).
    resolveAxis(world, axis) {
        let hit = false;
        for (const solid of world.solids) {
            if (!this.intersects(solid)) continue;
            hit = true;
            if (axis === 'x') {
                if (this.vx > 0) this.x = solid.x - this.width;
                else if (this.vx < 0) this.x = solid.x + solid.width;
                this.vx = 0;
            } else {
                if (this.vy > 0) {
                    this.y = solid.y - this.height;
                    this.grounded = true;
                } else if (this.vy < 0) {
                    this.y = solid.y + solid.height;
                }
                this.vy = 0;
            }
        }
        return hit;
    }
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
class World {
    constructor() {
        this.entities = [];
    }

    add(entity) {
        this.entities.push(entity);
        return entity;
    }

    get solids() {
        return this.entities.filter((e) => e.solid);
    }

    get movableEntities() {
        return this.entities.filter((e) => !e.solid);
    }

    update(dt) {
        for (const entity of this.entities) entity.update(dt, this);
    }

    render(context) {
        for (const entity of this.entities) entity.render(context);
    }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const world = new World();

// A couple of platforms to land on (the prototype defined walls but never
// spawned any — handy to have some here as a starting point).
world.add(new Wall(300, 450, 200, 30));
world.add(new Wall(550, 350, 150, 30));
world.add(new Portal(420, 240, 75, 10, 100, 113, Math.PI / 2));

const player = world.add(new Player(100, 113));

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let lastTime = null;
function gameLoop(now) {
    if (!lastTime) lastTime = now;
    let dt = (now - lastTime) / 1000; // seconds
    lastTime = now;
    dt = Math.min(dt, 0.05); // clamp big jumps (tab switches / pauses)

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    world.update(dt);
    world.render(ctx);
    input.clearFrame();

    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
