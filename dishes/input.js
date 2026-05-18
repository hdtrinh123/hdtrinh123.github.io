export const input = { x: 0, y: 0, clicked: false };

export function initInput(canvas) {
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    input.x = (e.clientX - r.left) * (canvas.width / r.width);
    input.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener("pointerdown", () => {
    input.clicked = true;
  });
}
