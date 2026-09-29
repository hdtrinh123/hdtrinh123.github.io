// Base class for everything that can be attached to a Ball with addComponent().
class Component{
    constructor() {
        this.ball = null
    }
    init(){}
    update(dt){}
}
