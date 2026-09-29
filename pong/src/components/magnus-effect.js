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
