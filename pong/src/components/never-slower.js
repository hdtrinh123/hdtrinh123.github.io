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
