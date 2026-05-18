export const ui = {
  update(inventory, input, currentSceneId) {
    if (input.clicked) {
      // check if clicked on inventory area
      if (input.x < 300 && input.y < 60) {
        //drop the first item in inventory for simplicity
        const itemId = inventory.pop();
        if (itemId) {
          const item = ItemsManager.items.find(it => it.id === itemId);
          if (item) {
            ItemsManager.dropItem(item, currentSceneId, input.x - item.w / 2, input.y - item.h / 2);
          }
        }
      }
      input.clicked = false; // consume click
    }
  },
  draw(ctx, inventory, assets) {
    //inventory
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(10 + i * 60, 10, 50, 50);
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.strokeRect(10 + i * 60, 10, 50, 50);
      const key = inventory[i];
      if (key) {
        const img = assets.get(key);
        if (img) ctx.drawImage(img, 10 + i * 60, 10, 50, 50);
      }
    }
  },
};
