import { TILE, TERRAIN_PASSABLE, TERRAIN_COST, TILE_SIZE } from '../constants.js';

/**
 * GameMap — stores the tile grid and spatial metadata.
 * Separate from ECS; tiles are value data, not entities.
 */
export class GameMap {
  constructor(width, height) {
    this.width  = width;
    this.height = height;

    // Flat typed arrays for perf — index = y * width + x
    this.tiles    = new Uint8Array(width * height);   // TILE enum values
    this.heights  = new Float32Array(width * height); // 0..1 elevation
    this.moisture = new Float32Array(width * height); // 0..1
    this.roads    = new Uint8Array(width * height);   // boolean
    this.fog      = new Uint8Array(width * height);   // 0=unseen, 1=seen, 2=visible
    this.buildings = new Int32Array(width * height).fill(-1); // entity ID or -1

    // Feature points (villages, ruins, mines, etc.)
    this.features = [];  // [{type, x, y, data}]

    // Spawn regions (one per potential starting player)
    this.spawnPoints = [];  // [{x, y}]
  }

  // -------------------------------------------------------
  // Tile accessors
  // -------------------------------------------------------

  idx(x, y) { return y * this.width + x; }

  getTile(x, y)  { return this.tiles[this.idx(x, y)]; }
  setTile(x, y, t) { this.tiles[this.idx(x, y)] = t; }

  getHeight(x, y)  { return this.heights[this.idx(x, y)]; }
  setHeight(x, y, v) { this.heights[this.idx(x, y)] = v; }

  getBuilding(x, y)  { return this.buildings[this.idx(x, y)]; }
  setBuilding(x, y, id) { this.buildings[this.idx(x, y)] = id; }
  clearBuilding(x, y) { this.buildings[this.idx(x, y)] = -1; }

  isInBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  isPassable(x, y) {
    if (!this.isInBounds(x, y)) return false;
    const tile = this.getTile(x, y);
    if (!TERRAIN_PASSABLE[tile]) return false;
    if (this.getBuilding(x, y) !== -1) return false;
    return true;
  }

  getCost(x, y) {
    return TERRAIN_COST[this.getTile(x, y)] ?? 1.0;
  }

  // -------------------------------------------------------
  // Fog of war
  // -------------------------------------------------------

  reveal(cx, cy, radius) {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!this.isInBounds(nx, ny)) continue;
        const i = this.idx(nx, ny);
        this.fog[i] = 2; // visible
      }
    }
  }

  /** Called each tick to downgrade 'visible' → 'seen' for out-of-range tiles */
  resetFogVisible() {
    for (let i = 0; i < this.fog.length; i++) {
      if (this.fog[i] === 2) this.fog[i] = 1;
    }
  }

  getFog(x, y) { return this.fog[this.idx(x, y)]; }

  // -------------------------------------------------------
  // Start positions
  // -------------------------------------------------------

  getStartPositions(count) {
    if (this.spawnPoints.length >= count) {
      return this.spawnPoints.slice(0, count);
    }
    // Fallback: corner positions
    const margin = 8;
    return [
      { x: margin,              y: margin },
      { x: this.width - margin, y: margin },
      { x: margin,              y: this.height - margin },
      { x: this.width - margin, y: this.height - margin },
    ].slice(0, count);
  }

  // -------------------------------------------------------
  // Serialization
  // -------------------------------------------------------

  serialize() {
    return {
      width:     this.width,
      height:    this.height,
      tiles:     Array.from(this.tiles),
      heights:   Array.from(this.heights),
      moisture:  Array.from(this.moisture),
      roads:     Array.from(this.roads),
      features:  this.features,
      spawnPoints: this.spawnPoints,
    };
  }

  static fromSnapshot(data) {
    const map      = new GameMap(data.width, data.height);
    map.tiles      = new Uint8Array(data.tiles);
    map.heights    = new Float32Array(data.heights);
    map.moisture   = new Float32Array(data.moisture);
    map.roads      = new Uint8Array(data.roads);
    map.features   = data.features   || [];
    map.spawnPoints= data.spawnPoints || [];
    return map;
  }
}
