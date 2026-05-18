import { ASSETS_LIST, preloadAssets } from "./assets.js";
import { initInput, input } from "./input.js";
import { createDish, ItemsManager } from "./items.js";
import { kitchen, dishwasher } from "./scenes.js";
import { ui } from "./ui.js";

const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");

let assets;
let scene;
const inventory = [];

const scenes = {}
const Statemanager = {
  changeScene(newScene) {
    console.debug('[Statemanager] changeScene called with', newScene && newScene.id);
    scene = newScene;
    currentSceneId = newScene.id;
    console.debug('[Statemanager] scene is now', currentSceneId);
  }
};

let currentSceneId = null;

async function boot() {
  assets = await preloadAssets(ASSETS_LIST, (p) => console.log("assets:", Math.round(p * 100) + "%"));
  initInput(canvas);

  // create initial items and register
  const fork = createDish(120, 200, "fork", "kitchen");
  ItemsManager.add(fork);
  const plate = createDish(200, 220, "plate", "dishwasher");
  ItemsManager.add(plate);
  console.debug('[boot] items after add:', ItemsManager.items);

  // no need to create scenes since they are imported directly

  // start in kitchen
  Statemanager.changeScene(kitchen);
  // main loop
  function gameLoop() {
  ItemsManager.update(input, inventory, assets, currentSceneId);
    scene.update(input, Statemanager);
    scene.draw(ctx, assets);
    ItemsManager.draw(ctx, assets, currentSceneId);
    ui.draw(ctx, inventory, assets);
    requestAnimationFrame(gameLoop);
  }

  gameLoop();
}

boot().catch(console.error);
        