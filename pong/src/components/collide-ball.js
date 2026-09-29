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
