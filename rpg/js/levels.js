import { tile_size } from "./constants.js";

export const levelmanager = {
  levels:[
    {
      id: "level1",
      rooms: [
        {
          id: "room1",
          adjacent: [],
          layout: [
            "#######",
            "#.....#",
            "#..#..#",
            "#.....#",
            "###.###",
            "###.###",
            "#.....#",
            "#..w..#",
            "#######",
          ],
        }
      ]
    },
    {
      id: "level2",
      rooms: [
        {
          id: "room1",
          adjacent: ["room2"],
          layout: [
            "#######",
            "#.....#",
            "#..#..#",
            "#.....#",
            "###.###",
            "###.###",
            "#.....#",
            "#.....#",
            "###0###",
          ],
        },
        {
          id: "room2",
          adjacent: ["room1"],
          layout: [
            "###0###",
            "#.....#",
            "#..#..#",
            "#.....#",
            "#.....#",
            "#..w..#",
            "#######",
          ],
        }
      ]
    },
    {
      id: "level3",
      rooms: [
        {
          id: "room1",
          adjacent: ["room2"],
          layout: [
            "#######",
            "#.....#",
            "#..#..#",
            "#..#..#",
            "#.###.#",
            "#..#..#",
            "#..#..#",
            "#.....#",
            "###0###",
          ],
        },
        {
          id: "room2",
          adjacent: ["room1", "room3"],
          layout: [
            "###0###",
            "#.....#",
            "###.###",
            "#.....#",
            "#.###.#",
            "#.#.#.#",
            "#.###.#",
            "#.....#",
            "###1###",
          ],
        },
        {
          id: "room3",
          adjacent: ["room3", "room4"],
          layout: [
            "###1###",
            "#.....#",
            "#..#..#",
            "#..#..#",
            "#.###.#",
            "#..#..#",
            "#..#..#",
            "#.....#",
            "###0###",
          ],
        },
        {
          id: "room4",
          adjacent: ["room3"],
          layout: [
            "###0###",
            "#.....#",
            "#.###.#",
            "#..w..#",
            "#######",
          ],
        }
      ]
    }
  ],
  
  drawRoom(ctx, room) {
    for (let y = 0; y < room.layout.length; y++) {
      for (let x = 0; x < room.layout[y].length; x++) {
        const tile = room.layout[y][x];
        if (tile === "#") {
          ctx.fillStyle = "darkgray";
          ctx.fillRect(x * tile_size, y * tile_size, tile_size, tile_size);
        } else if (tile === ".") {
          ctx.fillStyle = "lightgray";
          ctx.fillRect(x * tile_size, y * tile_size, tile_size, tile_size);
        } else if (!isNaN(parseInt(tile))) {
          ctx.fillStyle = "yellow";
          ctx.fillRect(x * tile_size, y * tile_size, tile_size, tile_size);
        } else if (tile === "w") {
          ctx.fillStyle = "white";
          ctx.fillRect(x * tile_size, y * tile_size, tile_size, tile_size);
        }
      }
    }
  },
};

const roomindex = new Map();
for (const lvl of levelmanager.levels) {
  for (const room of lvl.rooms) {
    roomindex.set(`${lvl.id}-${room.id}`, room);
  }
}

export let currentLevel = levelmanager.levels[0];
export let currentRoom = currentLevel.rooms[0];

export function setCurrentRoom(room) {
  currentRoom = room;
}
export function setCurrentLevel(level) {
  currentLevel = level;
}

export function getRoom(levelId, roomId) {
  return roomindex.get(`${levelId}-${roomId}`);
}