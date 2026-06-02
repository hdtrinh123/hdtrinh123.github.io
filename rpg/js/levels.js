import { tile_size } from "./constants.js";

// ---------------------------------------------------------------------------
// New level system
//
// A level is a collection of rooms. A room is a grid of cells. Each cell is a
// *stack* of objects (so multiple things can live on one tile), drawn bottom
// to top. Object types currently understood:
//   { type: "floor" }                         -> walkable
//   { type: "wall" }                          -> solid
//   { type: "door", id, target:{room,door} }  -> walkable, teleports the player
//
// An empty stack (no objects) is treated as solid "void".
// ---------------------------------------------------------------------------

export const OBJECT_COLORS = {
  floor: "lightgray",
  wall: "darkgray",
  door: "gold",
  exit: "limegreen",
};

export let levelData = null;
export let currentLevel = null;
export let currentRoom = null;

const levelIndex = new Map(); // levelId -> level
const roomIndex = new Map(); // `${levelId}-${roomId}` -> room

function buildIndex() {
  levelIndex.clear();
  roomIndex.clear();
  for (const lvl of levelData.levels) {
    levelIndex.set(lvl.id, lvl);
    for (const room of lvl.rooms) {
      roomIndex.set(`${lvl.id}-${room.id}`, room);
    }
  }
}

export async function loadLevels(url = "./levels/levels.json") {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load levels: ${res.status}`);
  levelData = await res.json();
  buildIndex();
  const start = levelData.start ?? {
    level: levelData.levels[0].id,
    room: levelData.levels[0].rooms[0].id,
  };
  currentLevel = getLevel(start.level);
  currentRoom = getRoom(start.level, start.room);
  return levelData;
}

export function getLevel(levelId) {
  return levelIndex.get(levelId);
}

export function getRoom(levelId, roomId) {
  return roomIndex.get(`${levelId}-${roomId}`);
}

export function setCurrentRoom(room) {
  currentRoom = room;
}

export function setCurrentLevel(level) {
  currentLevel = level;
}

/** The stack of objects at a tile, or [] if out of bounds. */
export function cellAt(room, tx, ty) {
  if (ty < 0 || ty >= room.height || tx < 0 || tx >= room.width) return [];
  return room.cells[ty]?.[tx] ?? [];
}

/** Find a door object by id in a room, returning {x, y, door} or null. */
export function findDoor(room, doorId) {
  for (let y = 0; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      for (const obj of cellAt(room, x, y)) {
        if (obj.type === "door" && obj.id === doorId) {
          return { x, y, door: obj };
        }
      }
    }
  }
  return null;
}

export function drawRoom(ctx, room) {
  for (let y = 0; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      for (const obj of cellAt(room, x, y)) {
        ctx.fillStyle = OBJECT_COLORS[obj.type] ?? "magenta";
        ctx.fillRect(x * tile_size, y * tile_size, tile_size, tile_size);
      }
    }
  }
}
