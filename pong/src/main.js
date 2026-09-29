// Creates the players and balls, then runs the game loop.
const player1 = new Player('left')
const player2 = new Player('right')
const balls = []
for(let i = 0; i<2; i++){
    const ball = new Ball("main",canvas.width/2+47*i,canvas.height/2,20,i-0.5,0.5)
    ball.addComponent(new LinearMovement())
    ball.addComponent(new BasicBounce())
    //ball.addComponent(new NeverSlower())
    ball.addComponent(new CollideBall())
    ball.addComponent(new MagnusEffect(0.02))
    balls.push(ball)
}

let lastTime = null;
function gameLoop(now) {
    if (!lastTime) lastTime = now;
    let dt = (now - lastTime) / 1000; // seconds
    lastTime = now;
    dt = Math.min(dt, 0.05); // clamp big jumps (tab switches / pauses)
    if(balls.length<40){
    let time=0.25*1000
        console.log(lastTime%(time))
        if((lastTime%(time))<(time) && (lastTime%(time))+dt*1000>=(time) && now>1000){
            const ball = new Ball("main",canvas.width/2,canvas.height/2,Math.random()*5+10,Math.sin(now/500),Math.cos(now/500))
            ball.addComponent(new LinearMovement())
            ball.addComponent(new BasicBounce())
            ball.addComponent(new NeverSlower())
            //ball.addComponent(new CollideBall())
            ball.addComponent(new MagnusEffect(0.02))
            balls.push(ball)
        }
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    input.clearFrame();
    player1.update(dt);
    player2.update(dt);
    balls.forEach(ball => {
        ball.update(dt)
        ball.draw()
    });
    player1.draw()
    player2.draw()

    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
