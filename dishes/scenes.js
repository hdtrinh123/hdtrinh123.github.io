export const kitchen = {
    id: "kitchen",
    update(input, statemanager) {
        if (input.clicked) {
            console.debug('[kitchen] requesting scene change -> dishwasher');
            statemanager.changeScene(dishwasher);
        }
        input.clicked = false; // consume click
    },
    draw(ctx, assets) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      const img = assets.get("kitchen");
      if (img) ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(230, 350, 60, 0, 2 * Math.PI);
      ctx.lineWidth = 5;
      ctx.strokeStyle = "black";
      ctx.stroke();
    }
};

export const dishwasher = {
    id: "dishwasher",
    update(input, statemanager) {
        if (input.clicked) {
            console.debug('[dishwasher] requesting scene change -> kitchen');
            statemanager.changeScene(kitchen);
        }
        input.clicked = false; // consume click
    },
    draw(ctx, assets) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      const img = assets.get("dishwasher");
      if (img) ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
    },
};
