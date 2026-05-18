const canvas = document.getElementById("gameCanvas");
/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext("2d");
const tile_size = 64;
let inputState = {
    keys: {}
};
window.addEventListener("keydown", (event) => {
    console.debug(`Key down: ${event.key}`);
    inputState.keys[event.key] = true;
});
window.addEventListener("keyup", (event) => {
    console.debug(`Key up: ${event.key}`);
    inputState.keys[event.key] = false;
});

let levelmanager = {
  room1: {
    width: 7,
    height: 5,
    layout: [
      "#######",
      "#.....#",
      "#s.#..#",
      "#.....#",
      "#######"
    ]
  },
  drawRoom: function(ctx, room) {
    for (let y = 0; y < room.height; y++) {
      for (let x = 0; x < room.width; x++) {
        const tile = room.layout[y][x];
        if (tile === "#") {
          ctx.fillStyle = "darkgray"; // wall color
          ctx.fillRect(x * tile_size, y * tile_size, tile_size, tile_size);
        } else if (tile === "s") {
          ctx.fillStyle = "green"; // spawn point color
          ctx.fillRect(x * tile_size, y * tile_size, tile_size, tile_size);
        }
      }
    }
  }
}
let currentRoom = levelmanager.room1;

// treat out-of-bounds as solid so entities can't leave the room
function isSolidTile(room, tx, ty) {
  if (ty < 0 || ty >= room.height || tx < 0 || tx >= room.width) return true;
  return room.layout[ty][tx] === "#";
}

// check if an object's AABB (in tile units, centered at obj.x/obj.y) would overlap any solid tile
function willCollide(obj, dx, dy, room) {
  const left = obj.x + dx - obj.width / 2;
  const right = obj.x + dx + obj.width / 2;
  const top = obj.y + dy - obj.height / 2;
  const bottom = obj.y + dy + obj.height / 2;

  const minTx = Math.floor(left);
  const maxTx = Math.floor(right - 1e-9);
  const minTy = Math.floor(top);
  const maxTy = Math.floor(bottom - 1e-9);

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (isSolidTile(room, tx, ty)) return true;
    }
  }
  return false;
}

let player = {
  // uses tile coordinates (fractional), draw is centered and scaled by TILE_SIZE
  x: 1.5,
  y: 2.5,
  width: 0.8, // tiles
  height: 0.8, // tiles
  color: "blue",
  speed: 0.05, // tiles per frame
  draw: function(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect((this.x - this.width / 2) * tile_size, (this.y - this.height / 2) * tile_size, this.width * tile_size, this.height * tile_size);
  },
  update: function(input) {
    // sprinting
    if (input.keys["Shift"]) this.speed = 0.1; else this.speed = 0.05;

    let dx = 0, dy = 0;
    if (input.keys["ArrowUp"]) dy -= this.speed;
    if (input.keys["ArrowDown"]) dy += this.speed;
    if (input.keys["ArrowLeft"]) dx -= this.speed;
    if (input.keys["ArrowRight"]) dx += this.speed;

    // axis-separated collision resolution
    if (dx !== 0) {
      if (!willCollide(this, dx, 0, currentRoom)) this.x += dx;
    }
    if (dy !== 0) {
      if (!willCollide(this, 0, dy, currentRoom)) this.y += dy;
    }
  }
}


function gameLoop() {
  // clear the whole canvas each frame
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  levelmanager.drawRoom(ctx, currentRoom);

  player.update(inputState);
  player.draw(ctx);
  requestAnimationFrame(gameLoop);
}

gameLoop();