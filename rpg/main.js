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
    id: 'room1',
    adjacent:["room2"],
    layout: [
      "#######",
      "#.....#",
      "#s.#..#",
      "#.....#",
      "###.###",
      "###.###",
      "#.....#",
      "#.....#",
      "###0###"
    ]
  },
  room2: {
    id: 'room2',
    adjacent:["room1"],
    layout: [
      "###0###",
      "#.....#",
      "#s.#..#",
      "#.....#",
      "#######",
    ]
  },
  drawRoom: function(ctx, room) {
    for (let y = 0; y < room.layout.length; y++) {
      for (let x = 0; x < room.layout[y].length; x++) {
        const tile = room.layout[y][x];
        if (tile === "#") {
          ctx.fillStyle = "darkgray"; // wall color
          ctx.fillRect(x * tile_size, y * tile_size, tile_size, tile_size);
        }
        else if (tile === ".") {
          ctx.fillStyle = "lightgray"; // floor color
          ctx.fillRect(x * tile_size, y * tile_size, tile_size, tile_size);
        }
        else if (parseInt(tile)!==NaN) {
          ctx.fillStyle = "yellow"; // door color
          ctx.fillRect(x * tile_size, y * tile_size, tile_size, tile_size);
        }
      }
    }
  }
}
let currentRoom = levelmanager.room1;

// treat out-of-bounds as solid so entities can't leave the room
function isSpecTile(string, tx, ty) {
  if (ty < 0 || ty >= currentRoom.layout.length || tx < 0 || tx >= currentRoom.layout[0].length) return true;
  return currentRoom.layout[ty][tx] === string;
}

// check if an object's AABB (in tile units, centered at obj.x/obj.y) would overlap any solid tile
function isTouching(obj, string) {
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

let player = {
  // uses tile coordinates (fractional), draw is centered and scaled by TILE_SIZE
  x: 1.5,
  y: 2.5,
  px: 1.5,
  py: 2.5,
  width: 0.8, // tiles
  height: 0.8, // tiles
  color: "blue",
  speed: 0.05, // tiles per frame
  justTeleported: false, // to prevent immediately re-teleporting
  draw: function(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect((this.x - this.width / 2) * tile_size, (this.y - this.height / 2) * tile_size, this.width * tile_size, this.height * tile_size);
  },
  update: function(input) {
    this.px = this.x;
    this.py = this.y;
    // sprinting
    if (input.keys["Shift"]) this.speed = 0.1; else this.speed = 0.05;

    let dx = 0, dy = 0;
    if (input.keys["ArrowUp"]) dy -= this.speed;
    if (input.keys["ArrowDown"]) dy += this.speed;
    if (input.keys["ArrowLeft"]) dx -= this.speed;
    if (input.keys["ArrowRight"]) dx += this.speed;

    if (dx !== 0) {
      this.x += dx;
    }
    if(isTouching(this, "#")) {
      for(let i = 0; i < 10; i++) {
        this.x -= dx / 10;
        if(!isTouching(this, "#")) break;
      }
    }
    if (dy !== 0) {
      this.y += dy;
    }
    if(isTouching(this, "#")) {
      for(let i = 0; i < 10; i++) {
        this.y -= dy / 10;
        if(!isTouching(this, "#")) break;
      }
    }
    if(isTouching(this, "0") && !this.justTeleported) {
      this.justTeleported = true;
      currentRoom = levelmanager[currentRoom.adjacent[0]];
      for (let y = 0; y < currentRoom.layout.length; y++) {
        for (let x = 0; x < currentRoom.layout[y].length; x++) {
          if (currentRoom.layout[y][x] === "0") {
            this.x = x + 0.5;
            this.y = y + 0.5;
          }
        }
      }
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