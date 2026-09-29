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

const UP_KEYS = {left:'KeyW',right:'ArrowUp'};
const DOWN_KEYS = {left:'KeyS',right:'ArrowDown'};
