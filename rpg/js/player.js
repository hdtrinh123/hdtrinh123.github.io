import { tile_size } from "./constants.js";
import { getDoorIndexTouching, isTouching } from "./collision.js";
import { currentLevel, currentRoom, setCurrentRoom, getRoom } from "./levels.js";
import { startLevelTransition } from "./game.js";

export const player = {
  x: 1.5,
  y: 2.5,
  px: 1.5,
  py: 2.5,
  width: 0.8,
  height: 0.8,
  color: "blue",
  speed: 0.05,
  justTeleported: false,
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(
      (this.x - this.width / 2) * tile_size,
      (this.y - this.height / 2) * tile_size,
      this.width * tile_size,
      this.height * tile_size
    );
  },
  update(input, deltaTime) {
    this.px = this.x;
    this.py = this.y;
    if (input.keys["Shift"]) this.speed = 0.1;
    else this.speed = 0.05;
    this.speed *= deltaTime / 10;

    let dx = 0,
      dy = 0;
    if (input.keys["ArrowUp"]) dy -= this.speed;
    if (input.keys["ArrowDown"]) dy += this.speed;
    if (input.keys["ArrowLeft"]) dx -= this.speed;
    if (input.keys["ArrowRight"]) dx += this.speed;

    if (dx !== 0) {
      this.x += dx;
    }
    if (isTouching(this, "#")) {
      for (let i = 0; i < 10; i++) {
        this.x -= dx / 10;
        if (!isTouching(this, "#")) break;
      }
    }
    if (dy !== 0) {
      this.y += dy;
    }
    if (isTouching(this, "#")) {
      for (let i = 0; i < 10; i++) {
        this.y -= dy / 10;
        if (!isTouching(this, "#")) break;
      }
    }
    const doorIndex = getDoorIndexTouching(this);
    if (
      doorIndex !== null &&
      !this.justTeleported &&
      currentRoom.adjacent[doorIndex]
    ) {
      this.justTeleported = true;
      const sourceId = currentRoom.id;
      setCurrentRoom(getRoom(currentLevel.id, currentRoom.adjacent[doorIndex]));
      const spawnDoor = String(currentRoom.adjacent.indexOf(sourceId));
      for (let y = 0; y < currentRoom.layout.length; y++) {
        for (let x = 0; x < currentRoom.layout[y].length; x++) {
          if (currentRoom.layout[y][x] === spawnDoor) {
            this.x = x + 0.5;
            this.y = y + 0.5;
          }
        }
      }
    }
    if (this.justTeleported && getDoorIndexTouching(this) === null) {
      this.justTeleported = false;
    }
    if (isTouching(this, "w")) {
      startLevelTransition();
    }
  },
};
