import { inputState } from "./input.js";
import { tile_size } from "./constants.js";
import {
  currentLevel,
  currentRoom,
  levelData,
  drawRoom,
  setCurrentLevel,
  setCurrentRoom,
} from "./levels.js";
import { player } from "./player.js";

const canvas = document.getElementById("gameCanvas");
/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext("2d");

let lastTime = 0;
let deltaTime = 0;

let state = "playing"; // "playing" | "transitioning" | "won"
let transitionTimer = 0;
const TRANSITION_DURATION = 500;

// Called when the player steps on an exit object.
export function startLevelTransition() {
  if (state !== "playing") return;
  state = "transitioning";
  transitionTimer = TRANSITION_DURATION;
}

function advanceLevel() {
  const i = levelData.levels.indexOf(currentLevel);
  const next = levelData.levels[i + 1];

  if (next) {
    setCurrentLevel(next);
    setCurrentRoom(next.rooms[0]);
    player.spawnInRoom(next.rooms[0]);
    player.justTeleported = false;
    // leave state as "transitioning" so the fade-in plays out
  } else {
    state = "won";
  }
}

// Camera centered on the player, clamped so it never scrolls past the level
// edges. A room smaller than the viewport is centered instead.
function getCamera(room) {
  const viewW = canvas.width;
  const viewH = canvas.height;
  const worldW = room.width * tile_size;
  const worldH = room.height * tile_size;

  let camX = player.x * tile_size - viewW / 2;
  let camY = player.y * tile_size - viewH / 2;

  camX = worldW <= viewW ? (worldW - viewW) / 2 : Math.max(0, Math.min(camX, worldW - viewW));
  camY = worldH <= viewH ? (worldH - viewH) / 2 : Math.max(0, Math.min(camY, worldH - viewH));

  return { camX, camY };
}

// Draw the room + player through the camera transform.
function drawWorld(room) {
  const { camX, camY } = getCamera(room);
  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));
  drawRoom(ctx, room);
  player.draw(ctx);
  ctx.restore();
}

function drawCenteredText(text) {
  ctx.fillStyle = "white";
  ctx.font = "32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
}

function gameLoop() {
  deltaTime = performance.now() - lastTime;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state === "playing") {
    player.update(inputState, deltaTime);
    drawWorld(currentRoom);
  } else if (state === "transitioning") {
    drawWorld(currentRoom);

    if (transitionTimer > 0) {
      // fade out
      const fade = 1 - transitionTimer / TRANSITION_DURATION;
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawCenteredText("Level complete! Loading next level...");
      transitionTimer -= deltaTime;
      if (transitionTimer <= 0) {
        transitionTimer = -TRANSITION_DURATION;
        advanceLevel();
      }
    } else if (state === "transitioning") {
      // fade in (advanceLevel may have switched us to "won")
      const fade = Math.abs(transitionTimer / TRANSITION_DURATION);
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0, fade)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      transitionTimer += deltaTime;
      if (transitionTimer >= 0) {
        transitionTimer = TRANSITION_DURATION;
        state = "playing";
      }
    }
  } else if (state === "won") {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawCenteredText("You Win!");
  }

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

export function startGame() {
  lastTime = performance.now();
  gameLoop();
}
