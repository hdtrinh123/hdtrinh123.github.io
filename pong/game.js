const canvas = document.getElementById('gameCanvas');
/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext('2d');
const [canvasWidth, canvasHeight] = [canvas.width, canvas.height]

const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
// `held` tracks keys currently down; `pressed` tracks keys that went down this
// frame (consumed by gameplay, then cleared at the end of the loop).
const input = {
    held: new Set(),
    pressed: new Set(),
    isHeld(...keys) { return keys.some((k) => this.held.has(k)); },
    wasPressed(...keys) { return keys.some((k) => this.pressed.has(k)); },
    clearFrame() { this.pressed.clear(); },
};

window.addEventListener('keydown', (event) => {
    if (!event.repeat) input.pressed.add(event.code);
    input.held.add(event.code);
});
window.addEventListener('keyup', (event) => {
    input.held.delete(event.code);
});

const UP_KEYS = {left:'KeyW',right:'ArrowUp'};
const DOWN_KEYS = {left:'KeyS',right:'ArrowDown'};

class Player{
    constructor(side,y=canvas.height/2){
        this.y = y;
        this.vy = 0;
        this.side=side;
        this.speed=400;
        this.height=50
        const padding = 30;
        if (this.side === 'left') {
            this.x = padding;
        } else if (this.side === 'right') {
            this.x = canvasWidth - padding;
        }
    }
    update(dt){
        this.vy=0
        if(input.held.has(UP_KEYS[this.side])){
            this.vy-=this.speed*dt
            console.log('up')
        }
        if(input.held.has(DOWN_KEYS[this.side])){
            this.vy+=this.speed*dt
        }
        this.y+=this.vy
        this.y=Math.min(Math.max(this.y,this.height),canvas.height-this.height)
    }
    draw(){
        ctx.beginPath()
        ctx.moveTo(this.x,this.y+this.height)
        ctx.lineTo(this.x,this.y-this.height)
        ctx.strokeStyle='white'
        ctx.lineWidth=3
        ctx.lineCap="round"
        ctx.stroke()
    }
}
class Ball{
    constructor(name="",x,y,s,vx=0,vy=0,r=0,vr=0, mass=1){
        this.name=name
        this.components=[]
        this.transform={
            x:x,
            y:y,
            size:s,
            vx:vx,
            vy:vy,
            r:r,
            vr:vr
        }
        this.mass=mass
    }
    addComponent(component){
        component.ball = this;
        this.components.push(component);;
        component.init();
        return component;
    }
    getComponent(componentClass) {
        return this.components.find(c => c instanceof componentClass) || null;
    }
    update(dt){
        for (let component of this.components){
            component.update(dt)
        }
    }
    draw(){
        ctx.beginPath()
        ctx.arc(this.transform.x,this.transform.y,this.transform.size,Math.PI+this.transform.r,this.transform.r)
        ctx.fillStyle = 'white'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(this.transform.x,this.transform.y,this.transform.size,this.transform.r,Math.PI+this.transform.r)
        ctx.fillStyle = 'red'
        ctx.fill()
    }
}
class Component{
    constructor() {
        this.ball = null
    }
    init(){}
    update(dt){}
}
class LinearMovement extends Component{
    constructor(){
        super()
    }
    update(dt){
        const transform = this.ball.transform
        transform.x+=transform.vx;
        transform.y+=transform.vy;
        transform.r+=transform.vr;
    }
}
// Spin convention: positive vr = clockwise on screen (matches how canvas draws r).
//
// Applies surface friction where the ball touches something.
// (ox, oy) is the offset from the ball's center to the contact point, and
// (sx, sy) is the velocity of the surface being touched.
// Keep friction <= 0.5, otherwise it overshoots and reverses the slip.
function applyFriction(ball, ox, oy, sx, sy, friction) {
    // Direction along the surface (the way a clockwise spin moves the contact point)
    const tx = -oy / ball.size;
    const ty = ox / ball.size;

    // How fast the ball's surface slides across the other surface at the contact point:
    // ball movement + spin movement - surface movement
    const slip = (ball.vx - sx) * tx + (ball.vy - sy) * ty + ball.size * ball.vr;

    // Friction pushes against the slip. The same push changes both movement and spin.
    const impulse = -slip * friction;
    ball.vx += impulse * tx;
    ball.vy += impulse * ty;
    ball.vr += impulse / ball.size;
}

function dot(ax,ay,bx,by){
    return ax*bx+ay*by
}

class BasicBounce extends Component{
    constructor(){
        super()
    }
    update(dt){
        const transform = this.ball.transform
        // Global environment constant for wall friction (can be slightly slicker than paddles)
        const WALL_FRICTION = 0.2;

        // 1. TOP WALL COLLISION (contact point is above the center)
        if (transform.y <= transform.size) {
            transform.y = transform.size;
            transform.vy = Math.abs(transform.vy);
            applyFriction(transform, 0, -transform.size, 0, 0, WALL_FRICTION);
        }

        // 2. BOTTOM WALL COLLISION (contact point is below the center)
        else if (transform.y >= canvas.height - transform.size) {
            transform.y = canvas.height - transform.size;
            transform.vy = -Math.abs(transform.vy);
            applyFriction(transform, 0, transform.size, 0, 0, WALL_FRICTION);
        }

        function bounceOfPaddle(ball, paddle) {
            // Matches how the paddle is drawn: centered on y, extending `height` both ways
            const paddleTop = paddle.y - paddle.height;
            const paddleBottom = paddle.y + paddle.height;

            const FRICTION = 0.4;        // How "sticky" the paddle is (0.0 = ice, 0.5 = max grip)
            const MAX_BALL_SPEED = 15;    // Absolute limit to keep the game playable
            const PADDLE_EDGE_DAMPENING = 2
            // Is the ball touching the paddle line at all?
            if (Math.abs(ball.x - paddle.x) >= ball.size ||
                ball.y + ball.size <= paddleTop ||
                ball.y - ball.size >= paddleBottom) {
                return;
            }

            if (ball.y < paddleTop || ball.y > paddleBottom) {
                // END OF THE PADDLE: bounce the circle off the end point
                const pointX = paddle.x;
                const pointY = ball.y < paddleTop ? paddleTop : paddleBottom;

                // Normal points from the end point to the ball's center
                const dx = ball.x - pointX;
                const dy = ball.y - pointY;
                const dist = Math.hypot(dx, dy);
                if (dist >= ball.size) return; // inside the box, but not touching the point
                const nx = dx / dist;
                const ny = dy / dist;

                // Push the ball out so it just touches the point
                ball.x = pointX + nx * ball.size;
                ball.y = pointY + ny * ball.size;

                // Velocity relative to the (possibly moving) paddle, split along the normal
                const vn = dot(ball.vx, ball.vy - paddle.vy/PADDLE_EDGE_DAMPENING, nx, ny);

                // Only bounce if moving into the point; if already leaving, leave it alone
                if (vn < 0) {
                    // Keep the tangent part, reverse the normal part: v - 2(v·n)n
                    ball.vx -= 2 * vn * nx ;
                    ball.vy -= 2 * vn * ny ;
                    applyFriction(ball, -nx * ball.size, -ny * ball.size, 0, paddle.vy, FRICTION);
                }
            }
            else {
                // FACE HIT. Use where the ball was last frame to decide which side it came from,
                // so a fast ball whose center already crossed the line can't pass through.
                const previousX = ball.x - ball.vx;
                if (previousX < paddle.x) {
                    // Came from the left: touching with the ball's right side
                    ball.x = paddle.x - ball.size;
                    ball.vx = -Math.abs(ball.vx);
                    applyFriction(ball, ball.size, 0, 0, paddle.vy, FRICTION);
                } else {
                    // Came from the right: touching with the ball's left side
                    ball.x = paddle.x + ball.size;
                    ball.vx = Math.abs(ball.vx);
                    applyFriction(ball, -ball.size, 0, 0, paddle.vy, FRICTION);
                }
            }

            // SPEED LIMITER
            const currentSpeed = Math.hypot(ball.vx, ball.vy);
            if (currentSpeed > MAX_BALL_SPEED) {
                ball.vx = (ball.vx / currentSpeed) * MAX_BALL_SPEED;
                ball.vy = (ball.vy / currentSpeed) * MAX_BALL_SPEED;
            }
        }
        bounceOfPaddle(transform,player1)
        bounceOfPaddle(transform,player2)
        const currentSpeed = Math.hypot(transform.vx, transform.vy);
        const MIN_BALL_SPEED = 1;    // Absolute limit to keep the game playable
        if (currentSpeed < MIN_BALL_SPEED) {
            transform.vx = (transform.vx / currentSpeed) * MIN_BALL_SPEED;
            transform.vy = (transform.vy / currentSpeed) * MIN_BALL_SPEED;
        }
        if (Math.abs(transform.vx) < 1) {
            transform.vx = Math.sign(transform.vx)*1;
        }
    }
}
class NeverSlower extends Component{
    constructor(){
        super()
        this.minimumSpeed=0
    }
    update(dt){
        const transform = this.ball.transform
        const currentSpeed = Math.hypot(transform.vx, transform.vy);
        this.minimumSpeed=Math.max(currentSpeed,this.minimumSpeed)
        if(currentSpeed<this.minimumSpeed) {
            transform.vy = (transform.vy/currentSpeed)*this.minimumSpeed
            transform.vx = (transform.vx/currentSpeed)*this.minimumSpeed
        }
    }
}
class CollideBall extends Component{
    constructor(){
        super()
    }
    update(dt){
        const transform = this.ball.transform
        balls.forEach(ball => {
            
            if(ball==this.ball || ball.getComponent(CollideBall)==null) return;
            let dx = ball.transform.x - transform.x
            let dy = ball.transform.y - transform.y
            let distsqr = dx**2 + dy**2
            let radiiSum = ball.transform.size+transform.size

            if(distsqr < radiiSum**2){
                let distance = Math.sqrt(distsqr);
                let overlap = radiiSum - distance;

                let nx = dx / distance;
                let ny = dy / distance;
                
                transform.x -= nx * overlap * 0.5;
                transform.y -= ny * overlap * 0.5;

                ball.transform.x += nx * overlap * 0.5;
                ball.transform.y += ny * overlap * 0.5;
                
                let dvx = ball.transform.vx - transform.vx;
                let dvy = ball.transform.vy - transform.vy;

                let velAlongNormal = dvx * nx + dvy * ny;

                if (velAlongNormal < 0) {
                let restitution = 0.1; // bounciness
                let impulseScalar = -(1 + restitution) * velAlongNormal;
                impulseScalar /= (1 / this.ball.mass + 1 / ball.mass);

                let impulseX = nx * impulseScalar;
                let impulseY = ny * impulseScalar;

                transform.vx -= (1 / this.ball.mass) * impulseX;
                transform.vy -= (1 / this.ball.mass) * impulseY;
                const Neverslow = this.ball.getComponent(NeverSlower)
                if (Neverslow!=null){
                    Neverslow.minimumSpeed=Math.hypot(transform.vx, transform.vy);
                }
                ball.transform.vx += (1 / ball.mass) * impulseX;
                ball.transform.vy += (1 / ball.mass) * impulseY;
                const Otherneverslow = ball.getComponent(NeverSlower)
                if (Otherneverslow!=null){
                    Otherneverslow.minimumSpeed=Math.hypot(ball.transform.vx, ball.transform.vy);
                }
                }
            }
        });
    }
}
class MagnusEffect extends Component{
    constructor(strength){
        super()
        this.strength=strength
    }
    update(dt){
        // 1. Get the direction the ball is moving
        const transform=this.ball.transform
        let speed = Math.hypot(transform.vx,transform.vy)
        let nvx = transform.vx/speed
        let nvy = transform.vy/speed

        let perpvx = -transform.vy
        let perpvy = transform.vx

        let forceMagnitude = transform.vr * speed * this.strength;

        // 4. Combine direction and magnitude to get the final force vector
        let magnus_x = perpvx * forceMagnitude;
        let magnus_y = perpvy * forceMagnitude;

        // 5. Apply the force
        transform.vx+=magnus_x
        transform.vy+=magnus_y
    }
}
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
    // if(balls.length<40){
    // let time=0.25*1000
    //     console.log(lastTime%(time))
    //     if((lastTime%(time))<(time) && (lastTime%(time))+dt*1000>=(time) && now>8000){
    //         const ball = new Ball("main",canvas.width/2,canvas.height/2,Math.random()*5+10,Math.sin(now/500),Math.cos(now/500))
    //         ball.addComponent(new LinearMovement())
    //         ball.addComponent(new BasicBounce())
    //         ball.addComponent(new NeverSlower())
    //         ball.addComponent(new CollideBall())
    //         balls.push(ball)
    //     }
    // }
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
