export const dishTypes = { fork: { w: 160, h: 160 }, plate: { w: 160, h: 160 } };

export function createDish(x, y, type, sceneId = "kitchen") {
  return {
    id: `dish_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    assetKey: type,
    x,
    y,
    w: dishTypes[type].w,
    h: dishTypes[type].h,
    held: false,
    location: sceneId,
  };
}

export const ItemsManager = {
  items: [],
  add(item) {
    this.items.push(item);
  },
  findAt(x, y, currentSceneId) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.location !== currentSceneId && it.location !== "held") continue;
      if (x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h) return it;
    }
    return null;
  },
  Storeitem(item, inventory, assets) {
    item.held = false;
    item.location = "inventory";
    // simple inventory behavior: push the assetKey for now
    inventory.push(item.id);
  },
  dropItem(item, sceneId, x, y) {
    item.held = false;
    item.location = sceneId;
    item.x = x;
    item.y = y;
  },
  update(input, inventory, assets, currentSceneId) {
    if (input.clicked) {
      const found = this.findAt(input.x, input.y, currentSceneId);
      if (found) {
        found.held = !found.held;
        // if now held, set location to held; if released, keep location as currentSceneId
        found.location = found.held ? "held" : currentSceneId;
        // consume click because we handled an item
        input.clicked = false;
      }
      // if no item found, do not consume click so scenes can react to it
    }
    for (const it of this.items) {
      if (it.held) {
        it.x = input.x - it.w / 2;
        it.y = input.y - it.h / 2;
      }
      //if touching inventory area store item
      if(!it.held && it.x < 300 && it.y < 60){
        this.Storeitem(it, inventory, assets);
        console.debug('[ItemsManager] item stored in inventory:', it);
      }
    }
  },
  draw(ctx, assets, currentSceneId) {
    for (const it of this.items) {
      if (it.location === currentSceneId) {
        const img = assets.get(it.assetKey);
        if (img) ctx.drawImage(img, it.x, it.y, it.w, it.h);
        else {
          ctx.fillStyle = "black";
          ctx.fillRect(it.x, it.y, it.w, it.h);
        }
      }
    }
    const held = this.items.find((i) => i.held);
    if (held) {
      const img = assets.get(held.assetKey);
      if (img) ctx.drawImage(img, held.x, held.y, held.w, held.h);
    }
  },
};
