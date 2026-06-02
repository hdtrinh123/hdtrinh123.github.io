import { cellAt } from "./levels.js";

// A tile is solid if it is out of bounds, empty (void), or contains a wall.
export function isSolid(room, tx, ty) {
  if (ty < 0 || ty >= room.height || tx < 0 || tx >= room.width) return true;
  const stack = cellAt(room, tx, ty);
  if (stack.length === 0) return true;
  return stack.some((obj) => obj.type === "wall");
}

// The tile coordinates an AABB (in tile units, centered at obj.x/obj.y) overlaps.
function overlappedTiles(obj) {
  const left = obj.x - obj.width / 2;
  const right = obj.x + obj.width / 2;
  const top = obj.y - obj.height / 2;
  const bottom = obj.y + obj.height / 2;

  return {
    minTx: Math.floor(left),
    maxTx: Math.floor(right - 1e-9),
    minTy: Math.floor(top),
    maxTy: Math.floor(bottom - 1e-9),
  };
}

// True if the object's AABB overlaps any solid tile in the room.
export function isTouchingSolid(obj, room) {
  const { minTx, maxTx, minTy, maxTy } = overlappedTiles(obj);
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (isSolid(room, tx, ty)) return true;
    }
  }
  return false;
}

// Returns the first object of the given type the AABB overlaps, or null.
function getTypeTouching(obj, room, type) {
  const { minTx, maxTx, minTy, maxTy } = overlappedTiles(obj);
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      for (const cellObj of cellAt(room, tx, ty)) {
        if (cellObj.type === type) return cellObj;
      }
    }
  }
  return null;
}

// Returns the first door object the AABB overlaps, or null.
export function getDoorTouching(obj, room) {
  return getTypeTouching(obj, room, "door");
}

// Returns the first exit object the AABB overlaps, or null.
export function getExitTouching(obj, room) {
  return getTypeTouching(obj, room, "exit");
}
