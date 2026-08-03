//This is just a generic entity class that just has a position, size, and color. It also has an AABB collision detection method.
//It can be used as a base class for more complex entities in the game, like players, enemies, or items.
class Entity {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
    }

    // AABB overlap test against another entity.
    intersects(other) {
        return (
            this.x < other.x + other.width &&
            this.x + this.width > other.x &&
            this.y < other.y + other.height &&
            this.y + this.height > other.y
        );
    }

    update(_dt, _world) {

    }

    render(context) {
        context.fillStyle = this.color;
        context.fillRect(this.x, this.y, this.width, this.height);
    }
}



//for extending:

class ExampleItem extends Entity {

    //Put all the things that you want to be able to specify about the entity
    constructor(x, y, width, height, weight) {
        //Use super and pass anything that the PARENT class needs.
        //Doing so create an entity with the any variable or fixd params
        super(x, y, width, height, 'darkgray');
        this.solid = true;
        this.weight = weight;
    }

    //This is an extension of entity, so it has all the methods like intersects or render.
    //If you want to add more methods or modify ones just put them in
    update(_dt, _world) {
        this.saysomething()
    }

    saysomething() {
        console.log("i exist :3")
    }

    
}