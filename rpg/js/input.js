export const inputState = {
  keys: {},
};

export function initInput() {
  window.addEventListener("keydown", (event) => {
    console.debug(`Key down: ${event.key}`);
    inputState.keys[event.key] = true;
  });
  window.addEventListener("keyup", (event) => {
    console.debug(`Key up: ${event.key}`);
    inputState.keys[event.key] = false;
  });
}
