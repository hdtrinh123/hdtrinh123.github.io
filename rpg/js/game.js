import { inputState } from "./input.js";
import {
  currentRoom,
  currentLevel,
  levelmanager,
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
const TRANSITION_DURATION = 1000;

export function startLevelTransition() {
  if (state !== "playing") return;
  state = "transitioning";
  transitionTimer = TRANSITION_DURATION;
}

function advanceLevel() {
  const i = levelmanager.levels.indexOf(currentLevel);
  const next = levelmanager.levels[i + 1];
  
  if (next) {
      setCurrentLevel(next);
      setCurrentRoom(next.rooms[0]);
      player.x = 1.5;
      player.y = 1.5;
      // Don't set state = "playing" here yet, let the fade-in finish!
  } else {
      state = "won";
  }
}


function gameLoop() {
  deltaTime = performance.now() - lastTime;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state === "playing") {
    player.update(inputState, deltaTime);
    levelmanager.drawRoom(ctx, currentRoom);
    player.draw(ctx);
  } else if (state === "transitioning") {
    //fade out
    if(transitionTimer > 0) {
      levelmanager.drawRoom(ctx, currentRoom);
      player.draw(ctx);
      const fade = 1 - transitionTimer / TRANSITION_DURATION;
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      ctx.font = "32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Level completed! Teleporting to next level...", canvas.width / 2, canvas.height / 2);
      transitionTimer -= deltaTime;
      if(transitionTimer <= 0) {
        transitionTimer = -TRANSITION_DURATION;
        advanceLevel();
      }
    }
    else {
      levelmanager.drawRoom(ctx, currentRoom);
      player.draw(ctx);
      const fade = Math.abs(transitionTimer / TRANSITION_DURATION);
      transitionTimer += deltaTime;
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0, fade)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      ctx.font = "32px sans-serif";
      ctx.textAlign = "center";
      if(transitionTimer >=0) {
        transitionTimer = TRANSITION_DURATION;
        state = "playing";
      }
    }
  } else if (state === "won") {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("You Win!", canvas.width / 2, canvas.height / 2);
  }

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

export function startGame() {
  lastTime = performance.now();
  gameLoop();
}
