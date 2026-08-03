const spinner={
    speed:0.1,//rotations per second
    rot:0,
    arc:0.08,
    thickness:80,
    color:"rgb(255, 255, 255)",
    badtimer:0
}
let radiusratio=0.8

function lerp(start, end, amount) {
    return start + (end - start) * amount
}
export const display = {
    flash(){
        spinner.badtimer=100
    },
    update(dt) {
        spinner.rot+=(spinner.speed*Math.PI)*dt*0.002
        // if(input.down){
        //     input.down=false
        //     spinner.badtimer=200
        // }
        if(spinner.badtimer>0){
            spinner.color="rgb(255,"+(lerp(255,0,spinner.badtimer/100))+","+(lerp(255,0,spinner.badtimer/100))+")"
        }
        spinner.badtimer-=dt
    },
    radius:radiusratio*Math.min(canvas.width,canvas.height)/2,
    draw(ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath()
        ctx.arc(canvas.width/2,canvas.height/2, this.radius, 0, 2*Math.PI)
        ctx.fillStyle="rgba(50,50,50,0.1)"
        ctx.strokeStyle="rgba(0,0,0,0.3)"
        ctx.lineWidth=10
        ctx.fill()
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(canvas.width/2,canvas.height/2, this.radius, spinner.rot, spinner.rot+spinner.arc)
        ctx.strokeStyle=spinner.color
        ctx.lineWidth=spinner.thickness
        ctx.stroke()
    }
}