import { currentRoom } from "./levels.js";

// treat out-of-bounds as solid so entities can't leave the room
export function isSpecTile(string, tx, ty) {
  if (
    ty < 0 ||
    ty >= currentRoom.layout.length ||
    tx < 0 ||
    tx >= currentRoom.layout[0].length
  ) {
    return true;
  }
  return currentRoom.layout[ty][tx] === string;
}

// check if an object's AABB (in tile units, centered at obj.x/obj.y) would overlap any solid tile
export function isTouching(obj, string) {
  const left = obj.x - obj.width / 2;
  const right = obj.x + obj.width / 2;
  const top = obj.y - obj.height / 2;
  const bottom = obj.y + obj.height / 2;

  const minTx = Math.floor(left);
  const maxTx = Math.floor(right - 1e-9);
  const minTy = Math.floor(top);
  const maxTy = Math.floor(bottom - 1e-9);

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (isSpecTile(string, tx, ty)) return true;
    }
  }
  return false;
}

/** Returns door digit (0–9) if the object overlaps that door tile, else null. */
export function getDoorIndexTouching(obj) {
  for (let d = 0; d <= 9; d++) {
    if (isTouching(obj, String(d))) return d;
  }
  return null;
}
