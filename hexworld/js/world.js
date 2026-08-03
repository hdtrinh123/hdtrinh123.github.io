// The 2D block world. No player — just terrain, physics, and wandering critters.

const B = {
  AIR: 0, STONE: 1, DIRT: 2, GRASS: 3, SAND: 4, WATER: 5, LAVA: 6, WOOD: 7,
  LEAVES: 8, COAL: 9, IRON: 10, GOLD: 11, DIAMOND: 12, BEDROCK: 13,
  CONJURED: 14, LIGHT: 15, FIRE: 16, SNOW: 17, SAPLING: 18, GLASS: 19,
  OBSIDIAN: 20, AMETHYST: 21, PLANKS: 22, TUFT: 23, MOSS: 24,
};

const BLOCKS = [];
function def(id, name, color, opts) {
  BLOCKS[id] = Object.assign({
    id, name, color, solid: true, liquid: false, gravity: false,
    flammable: false, replaceable: false, light: 0, hardness: 1,
  }, opts || {});
}
def(B.AIR, 'Air', null, { solid: false, replaceable: true });
def(B.STONE, 'Stone', '#7d7d84', { hardness: 3 });
def(B.DIRT, 'Dirt', '#6b4a2f');
def(B.GRASS, 'Grass Block', '#5a8f3c');
def(B.SAND, 'Sand', '#ddcf94', { gravity: true });
def(B.WATER, 'Water', '#2f6fd0', { solid: false, liquid: true, replaceable: true });
def(B.LAVA, 'Lava', '#e0641c', { solid: false, liquid: true, replaceable: true, light: 12 });
def(B.WOOD, 'Log', '#5c4426', { flammable: true });
def(B.LEAVES, 'Leaves', '#3f7a34', { flammable: true, hardness: 0.3 });
def(B.COAL, 'Coal Ore', '#4a4a52', { hardness: 3 });
def(B.IRON, 'Iron Ore', '#a8886a', { hardness: 3 });
def(B.GOLD, 'Gold Ore', '#c9a227', { hardness: 3 });
def(B.DIAMOND, 'Diamond Ore', '#4fd0c8', { hardness: 4 });
def(B.BEDROCK, 'Bedrock', '#2a2a2e', { hardness: Infinity });
def(B.CONJURED, 'Conjured Block', '#c3a6e8', { light: 6 });
def(B.LIGHT, 'Conjured Light', '#f5e8a8', { solid: false, replaceable: true, light: 15 });
def(B.FIRE, 'Fire', '#ff8a2b', { solid: false, replaceable: true, light: 14 });
def(B.SNOW, 'Snow', '#e8f0f5');
def(B.SAPLING, 'Sapling', '#5fa03f', { solid: false, replaceable: true, flammable: true });
def(B.GLASS, 'Glass', '#a8ccdd');
def(B.OBSIDIAN, 'Obsidian', '#2b2038', { hardness: 10 });
def(B.AMETHYST, 'Amethyst', '#9b6fd4', { light: 4 });
def(B.PLANKS, 'Planks', '#9c7043', { flammable: true });
def(B.TUFT, 'Grass', '#6aa347', { solid: false, replaceable: true, flammable: true });
def(B.MOSS, 'Moss', '#4d7a35');

// ---------------------------------------------------------------------------

// Stands in for the caster's pigment: each particle re-rolls a colour, as the
// mod's colouriser does.
const PIGMENT = ['#d8b8e0', '#bac5e2', '#c3a6e8', '#e0d0f5', '#9db4e8'];
const PARTICLE_CAP = 4000;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const grad = (h, x, y) => {
    const u = (h & 1) ? x : -x;
    const v = (h & 2) ? y : -y;
    return u + v;
  };
  return function (x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    ) * 0.5;
  };
}

// ---------------------------------------------------------------------------

class World {
  constructor(width, height, seed) {
    this.w = width;
    this.h = height;
    this.seed = seed;
    this.tiles = new Uint8Array(width * height);
    this.tint = new Uint8Array(width * height); // per-tile shade variation
    this.active = new Set();
    this.entities = [];
    this.nextEntityId = 1;
    this.raining = false;
    this.tickCount = 0;
    this.effects = [];    // transient visual effects (explosions, sparkles)
    this.particles = [];  // spell particles from the Particles pattern
    this.rng = mulberry32(seed ^ 0x9e3779b9);
    this.generate();
  }

  // A scratch copy for preview evaluation: editing the pattern list re-runs the
  // hex constantly, and we don't want that touching the real world.
  clone() {
    const w = Object.create(World.prototype);
    Object.assign(w, this);
    w.tiles = this.tiles.slice();
    w.tint = this.tint.slice();
    w.active = new Set();
    w.effects = [];
    w.particles = [];
    w.entities = this.entities.map((e) => ({ ...e, effects: { ...e.effects }, look: { ...e.look } }));
    w.caster = w.entities.find((e) => e.kind === 'caster') || null;
    w.sentinel = this.sentinel ? (w.entities.find((e) => e.id === this.sentinel.id) || null) : null;
    w.rng = mulberry32((this.seed ^ 0x5bf03635) >>> 0);
    return w;
  }

  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  // World y increases upward; the tile array stores row 0 as the top of the
  // world, so we flip on access. Everything outside this class uses world coords.
  get(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.inBounds(x, this.h - 1 - y)) return B.BEDROCK;
    return this.tiles[this.idx(x, this.h - 1 - y)];
  }

  set(x, y, id) {
    x = Math.floor(x); y = Math.floor(y);
    const ry = this.h - 1 - y;
    if (!this.inBounds(x, ry)) return false;
    const i = this.idx(x, ry);
    if (this.tiles[i] === id) return false;
    this.tiles[i] = id;
    this.tint[i] = Math.floor(this.rng() * 24);
    this.wake(x, y);
    return true;
  }

  wake(x, y) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = x + dx, ny = y + dy;
        if (this.inBounds(nx, this.h - 1 - ny)) this.active.add(ny * this.w + nx);
      }
    }
  }

  block(x, y) { return BLOCKS[this.get(x, y)]; }
  isSolid(x, y) { return BLOCKS[this.get(x, y)].solid; }
  isAir(x, y) { return this.get(x, y) === B.AIR; }

  // --- generation ----------------------------------------------------------
  generate() {
    const n1 = makeNoise(this.seed);
    const n2 = makeNoise(this.seed + 101);
    const nc = makeNoise(this.seed + 202);
    const no = makeNoise(this.seed + 303);
    const base = Math.floor(this.h * 0.62);
    const heights = new Int32Array(this.w);

    for (let x = 0; x < this.w; x++) {
      let hgt = base;
      hgt += n1(x * 0.012, 0) * 16;
      hgt += n2(x * 0.05, 8.3) * 5;
      hgt += n1(x * 0.003, 20) * 11;
      heights[x] = Math.max(8, Math.min(this.h - 12, Math.round(hgt)));
    }

    // Well below the typical surface, so oceans stay in the genuine dips
    // rather than drowning the whole map.
    const seaLevel = base - 14;

    for (let x = 0; x < this.w; x++) {
      const surface = heights[x];
      for (let y = 0; y < this.h; y++) {
        let id = B.AIR;
        if (y === 0) id = B.BEDROCK;
        else if (y < 4 && this.rng() < 0.5 - y * 0.12) id = B.BEDROCK;
        else if (y < surface - 4) id = B.STONE;
        else if (y < surface) id = B.DIRT;
        else if (y === surface) id = surface <= seaLevel + 1 ? B.SAND : B.GRASS;

        // caves
        if (id === B.STONE || id === B.DIRT) {
          const c = nc(x * 0.045, y * 0.055);
          const c2 = nc(x * 0.02 + 50, y * 0.02 + 50);
          if (c > 0.19 && y < surface - 3) id = B.AIR;
          else if (c2 > 0.28 && y < surface - 8) id = B.AIR;
        }

        // ores
        if (id === B.STONE) {
          const o = no(x * 0.16, y * 0.16);
          const depth = surface - y;
          if (o > 0.34 && depth > 6) {
            if (y < this.h * 0.12 && o > 0.42) id = B.DIAMOND;
            else if (y < this.h * 0.3) id = this.rng() < 0.4 ? B.GOLD : B.IRON;
            else id = this.rng() < 0.65 ? B.COAL : B.IRON;
          }
          if (o < -0.42 && depth > 14 && this.rng() < 0.25) id = B.AMETHYST;
        }

        // Caves stay dry — only genuine surface dips get flooded, in the pass
        // below. Deep caverns pool lava instead.
        if (id === B.AIR && y < this.h * 0.09) id = B.LAVA;

        const ry = this.h - 1 - y;
        this.tiles[this.idx(x, ry)] = id;
        this.tint[this.idx(x, ry)] = Math.floor(this.rng() * 24);
      }
    }

    // surface water pools in dips
    for (let x = 0; x < this.w; x++) {
      const s = heights[x];
      if (s < seaLevel) {
        for (let y = s + 1; y <= seaLevel; y++) {
          if (this.get(x, y) === B.AIR) this.set(x, y, B.WATER);
        }
        if (this.get(x, s) === B.GRASS) this.set(x, s, B.SAND);
      }
    }

    // trees & tufts
    for (let x = 4; x < this.w - 4; x++) {
      const s = heights[x];
      if (this.get(x, s) !== B.GRASS) continue;
      if (this.rng() < 0.055) {
        this.growTree(x, s + 1);
        x += 3;
      } else if (this.rng() < 0.22) {
        this.set(x, s + 1, B.TUFT);
      }
    }

    this.active.clear();
    this.spawnInitialEntities(heights);
  }

  growTree(x, y) {
    const h = 4 + Math.floor(this.rng() * 4);
    for (let i = 0; i < h; i++) {
      if (this.get(x, y + i) !== B.AIR) break;
      this.set(x, y + i, B.WOOD);
    }
    const top = y + h;
    const r = 2;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (dx * dx + dy * dy > r * r + 1) continue;
        const tx = x + dx, ty = top + dy;
        if (this.get(tx, ty) === B.AIR) this.set(tx, ty, B.LEAVES);
      }
    }
  }

  spawnInitialEntities(heights) {
    let mid = Math.floor(this.w / 2);
    // Find a column with clear headroom, so the Mind never starts inside a tree.
    const clearAt = (x) => {
      let y = (heights ? heights[x] : Math.floor(this.h * 0.62)) + 1;
      for (let top = y; top < this.h - 4; top++) {
        if (this.isAir(x, top) && this.isAir(x, top + 1)
          && this.isAir(x, top + 2) && this.isAir(x, top + 3)) return top + 1;
      }
      return y;
    };
    let spawnY = clearAt(mid);
    for (let probe = 0; probe < 40 && this.get(mid, spawnY) !== B.AIR; probe++) {
      mid += 3;
      spawnY = clearAt(mid);
    }
    this.caster = this.spawn({
      name: 'The Mind', kind: 'caster', x: mid + 0.5, y: spawnY,
      w: 0.8, h: 1.2, hp: 20, flying: true,
    });
    for (let i = 0; i < 14; i++) {
      const x = 8 + Math.floor(this.rng() * (this.w - 16));
      let y = this.h - 2;
      while (y > 1 && !this.isSolid(x, y - 1)) y--;
      if (y < 2) continue;
      const monster = this.rng() < 0.35;
      this.spawn({
        name: monster ? 'Wisp' : 'Critter',
        kind: monster ? 'monster' : 'animal',
        x: x + 0.5, y, w: 0.8, h: monster ? 1.2 : 0.8,
        hp: monster ? 12 : 8,
        wander: (this.rng() - 0.5) * 0.08,
      });
    }
  }

  // --- entities ------------------------------------------------------------
  spawn(props) {
    const e = Object.assign({
      id: this.nextEntityId++, name: 'Entity', kind: 'animal',
      x: 0, y: 0, vx: 0, vy: 0, w: 0.8, h: 1.0, hp: 10, maxHp: 10,
      look: { x: 1, y: 0 }, effects: {}, scale: 1, flying: false,
      flightTicks: 0, onGround: false, focus: null, wander: 0, age: 0,
    }, props);
    e.maxHp = e.hp;
    this.entities.push(e);
    return e;
  }

  getEntity(id) { return this.entities.find((e) => e.id === id) || null; }

  removeEntity(id) {
    const i = this.entities.findIndex((e) => e.id === id);
    if (i >= 0 && this.entities[i].kind !== 'caster') this.entities.splice(i, 1);
  }

  entitiesNear(x, y, radius) {
    const r2 = radius * radius;
    return this.entities.filter((e) => {
      const dx = e.x - x, dy = (e.y + e.h / 2) - y;
      return dx * dx + dy * dy <= r2;
    });
  }

  entityAt(x, y) {
    let best = null, bestD = Infinity;
    for (const e of this.entities) {
      const dx = e.x - x, dy = (e.y + e.h / 2) - y;
      const d = dx * dx + dy * dy;
      if (d < 4 && d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  // --- raycast -------------------------------------------------------------
  // 2D DDA. Returns { hit, x, y, nx, ny } where n is the face normal.
  raycast(ox, oy, dx, dy, maxDist) {
    const len = Math.hypot(dx, dy);
    if (len === 0) return null;
    dx /= len; dy /= len;
    maxDist = maxDist || 32;

    let x = Math.floor(ox), y = Math.floor(oy);
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
    const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
    let tMaxX = dx === 0 ? Infinity : ((dx > 0 ? x + 1 - ox : ox - x) * tDeltaX);
    let tMaxY = dy === 0 ? Infinity : ((dy > 0 ? y + 1 - oy : oy - y) * tDeltaY);

    let nx = 0, ny = 0;
    let travelled = 0;
    while (travelled <= maxDist) {
      if (this.isSolid(x, y)) return { hit: true, x, y, nx, ny };
      if (tMaxX < tMaxY) {
        x += stepX; travelled = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0;
      } else {
        y += stepY; travelled = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY;
      }
    }
    return null;
  }

  raycastEntity(ox, oy, dx, dy, maxDist) {
    const len = Math.hypot(dx, dy);
    if (len === 0) return null;
    dx /= len; dy /= len;
    maxDist = maxDist || 32;
    const step = 0.25;
    for (let t = 0.5; t <= maxDist; t += step) {
      const px = ox + dx * t, py = oy + dy * t;
      if (this.isSolid(px, py)) return null;
      for (const e of this.entities) {
        if (px >= e.x - e.w / 2 && px <= e.x + e.w / 2 && py >= e.y && py <= e.y + e.h) return e;
      }
    }
    return null;
  }

  // --- world edits used by spells ------------------------------------------
  breakBlock(x, y) {
    const id = this.get(x, y);
    if (id === B.AIR || BLOCKS[id].hardness === Infinity) return false;
    this.set(x, y, B.AIR);
    this.addEffect('break', x + 0.5, y + 0.5, BLOCKS[id].color);
    return true;
  }

  placeBlock(x, y, id) {
    const cur = this.get(x, y);
    if (!BLOCKS[cur].replaceable) return false;
    this.set(x, y, id);
    return true;
  }

  explode(x, y, power, fire) {
    const r = Math.max(1, power);
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy;
        const id = this.get(tx, ty);
        if (id === B.AIR || BLOCKS[id].hardness === Infinity) continue;
        if (d + this.rng() * 0.8 < r) {
          this.set(tx, ty, fire && this.rng() < 0.25 ? B.FIRE : B.AIR);
        }
      }
    }
    for (const e of this.entities) {
      const dx = e.x - x, dy = e.y - y;
      const d = Math.hypot(dx, dy);
      if (d < r * 1.5 && d > 0) {
        const f = (1 - d / (r * 1.5)) * power * 0.35;
        e.vx += (dx / d) * f;
        e.vy += (dy / d) * f + 0.1;
        if (e.kind !== 'caster') e.hp -= power * 2;
      }
    }
    this.addEffect('explosion', x, y, fire ? '#ff8a2b' : '#e8e0d0', r);
  }

  addEffect(kind, x, y, color, size) {
    this.effects.push({ kind, x, y, color: color || '#ffffff', size: size || 1, life: 1 });
    if (this.effects.length > 300) this.effects.shift();
  }

  // Spell particles get their own pool: a long polyline emits far more of them
  // than the effect list is sized for, and they need only a position and a life.
  spawnParticle(x, y) {
    const pal = PIGMENT;
    this.particles.push({
      x, y,
      // Barely any drift — just enough to keep a trail from looking like a
      // drawn line.
      vx: (this.rng() - 0.5) * 0.004,
      vy: (this.rng() - 0.5) * 0.004,
      color: pal[Math.floor(this.rng() * pal.length)],
      life: 1,
    });
    if (this.particles.length > PARTICLE_CAP) this.particles.shift();
  }

  tickParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.035;   // ~1.4s at 20 ticks/s
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  // --- simulation ----------------------------------------------------------
  tick() {
    this.tickCount++;
    this.tickTiles();
    this.tickEntities();
    this.tickParticles();
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].life -= 0.04;
      if (this.effects[i].life <= 0) this.effects.splice(i, 1);
    }
    if (this.raining && this.tickCount % 3 === 0) this.rainTick();
  }

  rainTick() {
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(this.rng() * this.w);
      for (let y = this.h - 1; y > 0; y--) {
        const id = this.get(x, y);
        if (id === B.FIRE) { this.set(x, y, B.AIR); break; }
        if (BLOCKS[id].solid) break;
      }
    }
  }

  tickTiles() {
    if (!this.active.size) return;
    const list = Array.from(this.active);
    this.active.clear();
    // Bottom-up so falling blocks cascade correctly in one pass.
    list.sort((a, b) => (a % this.w) - (b % this.w) || Math.floor(a / this.w) - Math.floor(b / this.w));
    for (const key of list) {
      const x = key % this.w;
      const y = Math.floor(key / this.w);
      this.tickTile(x, y);
    }
  }

  tickTile(x, y) {
    const id = this.get(x, y);
    const b = BLOCKS[id];
    if (!b) return;

    if (b.gravity) {
      const below = this.get(x, y - 1);
      if (BLOCKS[below].replaceable && below !== id) {
        this.set(x, y, below === B.AIR ? B.AIR : below);
        this.set(x, y - 1, id);
        return;
      }
    }

    if (id === B.WATER || id === B.LAVA) this.tickLiquid(x, y, id);
    else if (id === B.FIRE) this.tickFire(x, y);
    else if (id === B.CONJURED || id === B.LIGHT) {
      // conjured blocks are permanent here (sandbox), just keep them lit
    } else if (id === B.SAPLING) {
      if (this.rng() < 0.02 && this.isSolid(x, y - 1)) {
        this.set(x, y, B.AIR);
        this.growTree(x, y);
      } else this.wake(x, y);
    } else if (id === B.GRASS) {
      if (this.isSolid(x, y + 1)) this.set(x, y, B.DIRT);
    } else if (id === B.LEAVES || id === B.TUFT || id === B.SNOW) {
      if (id === B.TUFT && !this.isSolid(x, y - 1)) this.set(x, y, B.AIR);
    }
  }

  tickLiquid(x, y, id) {
    const other = id === B.WATER ? B.LAVA : B.WATER;
    // water + lava meet -> stone/obsidian
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (this.get(x + dx, y + dy) === other) {
        this.set(x, y, id === B.LAVA ? B.OBSIDIAN : B.STONE);
        return;
      }
    }
    const flowChance = id === B.LAVA ? 0.25 : 1;
    if (this.rng() > flowChance) { this.wake(x, y); return; }

    const below = this.get(x, y - 1);
    if (BLOCKS[below].replaceable && below !== id) {
      this.set(x, y - 1, id);
      this.set(x, y, B.AIR);
      return;
    }
    if (below === id || BLOCKS[below].solid) {
      const dirs = this.rng() < 0.5 ? [-1, 1] : [1, -1];
      for (const dx of dirs) {
        const side = this.get(x + dx, y);
        if (BLOCKS[side].replaceable && side !== id) {
          this.set(x + dx, y, id);
          this.set(x, y, B.AIR);
          return;
        }
      }
    }
  }

  tickFire(x, y) {
    let spread = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nid = this.get(x + dx, y + dy);
      if (BLOCKS[nid].flammable && this.rng() < 0.16) {
        this.set(x + dx, y + dy, B.FIRE);
        spread = true;
      }
    }
    if (this.rng() < 0.12) {
      const under = this.get(x, y - 1);
      if (!BLOCKS[under].flammable && !spread) { this.set(x, y, B.AIR); return; }
    }
    this.wake(x, y);
  }

  tickEntities() {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.age++;
      this.tickEffects(e);
      if (e.hp <= 0 && e.kind !== 'caster') {
        this.addEffect('break', e.x, e.y + e.h / 2, '#d05a5a');
        this.entities.splice(i, 1);
        continue;
      }
      if (e.kind === 'caster' || e.flying || e.flightTicks > 0) {
        if (e.flightTicks > 0) e.flightTicks--;
        e.vy *= 0.86;
        e.vx *= 0.86;
      } else {
        e.vy -= 0.045;
        if (e.wander && e.onGround && this.rng() < 0.02) e.wander = (this.rng() - 0.5) * 0.1;
        if (e.wander) e.vx = e.vx * 0.7 + e.wander * 0.3;
        e.vx *= 0.92;
      }
      if (e.effects.levitation) e.vy += 0.09;
      if (e.effects.slowness) { e.vx *= 0.6; }

      e.vy = Math.max(-1.2, Math.min(1.2, e.vy));
      this.moveEntity(e, e.vx, e.vy);

      // hurt by lava/fire
      const mid = this.get(e.x, e.y + e.h / 2);
      if (mid === B.LAVA) e.hp -= 0.4;
      if (mid === B.FIRE) e.hp -= 0.15;
      if (e.effects.poison) e.hp -= 0.03;
      if (e.effects.wither) e.hp -= 0.05;
      if (e.effects.regeneration) e.hp = Math.min(e.maxHp, e.hp + 0.05);

      if (Math.abs(e.vx) > 0.01) e.look = { x: Math.sign(e.vx), y: 0 };
    }
  }

  tickEffects(e) {
    for (const k of Object.keys(e.effects)) {
      e.effects[k] -= 1;
      if (e.effects[k] <= 0) delete e.effects[k];
    }
  }

  moveEntity(e, dx, dy) {
    const hw = (e.w * e.scale) / 2, hh = e.h * e.scale;
    const collides = (px, py) => {
      for (let x = Math.floor(px - hw); x <= Math.floor(px + hw - 0.001); x++) {
        for (let y = Math.floor(py); y <= Math.floor(py + hh - 0.001); y++) {
          if (this.isSolid(x, y)) return true;
        }
      }
      return false;
    };
    let nx = e.x + dx;
    if (!collides(nx, e.y)) e.x = nx; else e.vx = 0;
    let ny = e.y + dy;
    e.onGround = false;
    if (!collides(e.x, ny)) e.y = ny;
    else {
      if (dy < 0) e.onGround = true;
      e.vy = 0;
    }
    e.x = Math.max(1, Math.min(this.w - 1, e.x));
    e.y = Math.max(0, Math.min(this.h - 1, e.y));
  }
}

window.WorldLib = { World, BLOCKS, B, mulberry32 };
