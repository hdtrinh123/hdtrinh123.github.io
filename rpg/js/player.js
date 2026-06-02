import { tile_size } from "./constants.js";
import { getDoorTouching, getExitTouching, isTouchingSolid } from "./collision.js";
import { startLevelTransition } from "./game.js";
import {
  currentLevel,
  currentRoom,
  setCurrentRoom,
  setCurrentLevel,
  getRoom,
  getLevel,
  findDoor,
} from "./levels.js";

export const player = {
  x: 1.5,
  y: 1.5,
  px: 1.5,
  py: 1.5,
  width: 0.8,
  height: 0.8,
  color: "blue",
  speed: 0.03,
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
  // Place the player at a room's spawn point (or its center as a fallback).
  spawnInRoom(room) {
    const spawn = room.spawn ?? { x: room.width / 2, y: room.height / 2 };
    this.x = spawn.x;
    this.y = spawn.y;
    this.px = this.x;
    this.py = this.y;
  },
  update(input, deltaTime) {
    this.px = this.x;
    this.py = this.y;
    if (input.keys["Shift"]) this.speed = 0.06;
    else this.speed = 0.03;
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
    if (isTouchingSolid(this, currentRoom)) {
      for (let i = 0; i < 10; i++) {
        this.x -= dx / 10;
        if (!isTouchingSolid(this, currentRoom)) break;
      }
    }
    if (dy !== 0) {
      this.y += dy;
    }
    if (isTouchingSolid(this, currentRoom)) {
      for (let i = 0; i < 10; i++) {
        this.y -= dy / 10;
        if (!isTouchingSolid(this, currentRoom)) break;
      }
    }

    const door = getDoorTouching(this, currentRoom);
    if (door && door.target && !this.justTeleported) {
      this.teleport(door.target);
    }
    if (this.justTeleported && getDoorTouching(this, currentRoom) === null) {
      this.justTeleported = false;
    }

    if (getExitTouching(this, currentRoom)) {
      startLevelTransition();
    }
  },
  // Move to a door's target: a room (optionally in another level) and a door id.
  teleport(target) {
    const levelId = target.level ?? currentLevel.id;
    const targetRoom = getRoom(levelId, target.room);
    if (!targetRoom) return; // unresolved target -> ignore

    this.justTeleported = true;
    if (target.level) setCurrentLevel(getLevel(target.level));
    setCurrentRoom(targetRoom);

    const dest = findDoor(targetRoom, target.door);
    if (dest) {
      this.x = dest.x + 0.5;
      this.y = dest.y + 0.5;
    } else {
      this.spawnInRoom(targetRoom);
    }
  },
};
