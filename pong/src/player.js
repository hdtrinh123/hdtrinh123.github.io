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
