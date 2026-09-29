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
