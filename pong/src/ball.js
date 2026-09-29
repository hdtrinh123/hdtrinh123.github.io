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
