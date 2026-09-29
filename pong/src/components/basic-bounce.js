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
