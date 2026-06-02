import { initInput } from "./input.js";
import { startGame } from "./game.js";
import { loadLevels, currentRoom } from "./levels.js";
import { player } from "./player.js";

initInput();

loadLevels()
  .then(() => {
    player.spawnInRoom(currentRoom);
    startGame();
  })
  .catch((err) => {
    console.error(err);
    document.body.insertAdjacentHTML(
      "beforeend",
      `<p style="color:white">Failed to load levels. If you opened this file directly, run a local web server (fetch won't work over file://).</p>`
    );
  });
