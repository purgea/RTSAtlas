import { NoiseGenerator }  from './NoiseGenerator.js';
import { SeededRandom }    from '../utils/SeededRandom.js';
import { GameMap }         from '../systems/GameMap.js';
import { TILE }            from '../constants.js';

/**
 * ProceduralGenerator — creates fully playable maps from a seed.
 *
 * Pipeline:
 *  1. Height map (fbm noise)
 *  2. Moisture map (independent fbm)
 *  3. Biome classification (height + moisture → tile type)
 *  4. River generation (flow from peaks to sea)
 *  5. Forest thickening
 *  6. Road network (connect start positions)
 *  7. Feature placement (villages, ruins, mines, camps)
 *  8. Spawn point selection
 */
export class ProceduralGenerator {
  constructor(seed, width, height, settings = {}) {
    this.seed     = seed;
    this.width    = width;
    this.height   = height;
    this.settings = settings;

    this.rng      = new SeededRandom(seed);
    this.noise    = new NoiseGenerator(seed);
    this.noiseM   = new NoiseGenerator(seed ^ 0xdeadbeef); // different seed for moisture
  }

  generate() {
    const map = new GameMap(this.width, this.height);

    console.time('[ProceduralGenerator] generate');

    this._generateTerrain(map);
    this._generateRivers(map);
    this._thickenForests(map);
    this._placeRoads(map);
    this._placeFeatures(map);
    this._selectSpawnPoints(map);
    this._initFog(map);

    console.timeEnd('[ProceduralGenerator] generate');
    return map;
  }

  // -------------------------------------------------------
  // 1. Terrain
  // -------------------------------------------------------

  _generateTerrain(map) {
    const { width, height, noise, noiseM } = this;
    const scale     = this.settings.scale     ?? 0.006;
    const mScale    = this.settings.mScale    ?? 0.008;
    const seaLevel  = this.settings.seaLevel  ?? 0.38;
    const mountainH = this.settings.mountainH ?? 0.72;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const h = noise.fbm(x * scale, y * scale, 6);
        const m = noiseM.fbm(x * mScale, y * mScale, 4);

        map.setHeight(x, y, h);
        map.moisture[map.idx(x, y)] = m;

        const tile = this._classifyBiome(h, m, seaLevel, mountainH, x, y, width, height);
        map.setTile(x, y, tile);
      }
    }
  }

  _classifyBiome(h, m, seaLevel, mountainH, x, y, width, height) {
    // Border ocean
    const edgeDist = Math.min(x, y, width - 1 - x, height - 1 - y) / (Math.min(width, height) * 0.15);
    const hAdj     = h * Math.min(1.0, edgeDist);

    if (hAdj < seaLevel * 0.6) return TILE.DEEP_WATER;
    if (hAdj < seaLevel)       return TILE.WATER;
    if (hAdj < seaLevel + 0.03) return TILE.SAND;
    if (hAdj > mountainH + 0.08) return TILE.SNOW;   // high peaks
    if (hAdj > mountainH)       return TILE.MOUNTAIN;
    if (hAdj > mountainH - 0.05 && m < 0.35) return TILE.CLIFF;

    if (m > 0.70 && hAdj < seaLevel + 0.15) return TILE.SWAMP;
    if (m > 0.55 && hAdj > seaLevel + 0.05) return TILE.FOREST;
    if (hAdj > seaLevel + 0.3 && m < 0.35)  return TILE.SAND; // dry highlands
    return TILE.GRASS;
  }

  // -------------------------------------------------------
  // 2. Rivers
  // -------------------------------------------------------

  _generateRivers(map) {
    const count = this.settings.riverCount ?? Math.floor(this.width / 25);
    const { rng } = this;

    for (let r = 0; r < count; r++) {
      // Start from high ground
      let sx, sy;
      let attempts = 0;
      do {
        sx = rng.nextInt(10, map.width - 10);
        sy = rng.nextInt(10, map.height - 10);
        attempts++;
      } while (map.getHeight(sx, sy) < 0.65 && attempts < 50);

      this._flowRiver(map, sx, sy, rng.nextInt(60, 150));
    }
  }

  _flowRiver(map, sx, sy, maxLength) {
    let x = sx, y = sy;
    const visited = new Set();

    for (let step = 0; step < maxLength; step++) {
      const key = y * this.width + x;
      if (visited.has(key)) break;
      visited.add(key);

      const tile = map.getTile(x, y);
      if (tile === TILE.WATER || tile === TILE.DEEP_WATER) break;

      // Carve river
      if (tile !== TILE.SAND) {
        map.setTile(x, y, TILE.WATER);
      }

      // Flow downhill with slight randomness
      const neighbours = [
        { nx: x-1, ny: y }, { nx: x+1, ny: y },
        { nx: x, ny: y-1 }, { nx: x, ny: y+1 },
      ];

      let best = null, bestH = Infinity;
      for (const { nx, ny } of neighbours) {
        if (nx < 1 || ny < 1 || nx >= this.width-1 || ny >= this.height-1) continue;
        const h = map.getHeight(nx, ny) - this.rng.nextFloat(0, 0.06);
        if (h < bestH) { bestH = h; best = { nx, ny }; }
      }

      if (!best) break;
      x = best.nx;
      y = best.ny;
    }
  }

  // -------------------------------------------------------
  // 3. Forest thickening
  // -------------------------------------------------------

  _thickenForests(map) {
    const thickness = this.settings.forestThickness ?? 2;
    const copy      = new Uint8Array(map.tiles);

    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        if (copy[map.idx(x, y)] !== TILE.FOREST) continue;
        for (let dy = -thickness; dy <= thickness; dy++) {
          for (let dx = -thickness; dx <= thickness; dx++) {
            const nx = x + dx, ny = y + dy;
            if (!map.isInBounds(nx, ny)) continue;
            if (copy[map.idx(nx, ny)] === TILE.GRASS && this.rng.chance(0.4)) {
              map.setTile(nx, ny, TILE.FOREST);
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------
  // 4. Roads
  // -------------------------------------------------------

  _placeRoads(map) {
    // Roads are created after spawn points are determined;
    // we'll call this again after spawn selection.
    // For now, place a few random crossroads across the map.
    const centers = this._findGrasslandCenters(4);
    for (let i = 0; i < centers.length - 1; i++) {
      this._drawRoad(map, centers[i], centers[i + 1]);
    }
  }

  _findGrasslandCenters(count) {
    const centers = [];
    const attempts = 200;
    for (let i = 0; i < attempts && centers.length < count; i++) {
      const x = this.rng.nextInt(5, this.width - 5);
      const y = this.rng.nextInt(5, this.height - 5);
      if (this.map_getTileOrCache) {
        // noop
      }
      centers.push({ x, y });
    }
    return centers;
  }

  _drawRoad(map, a, b) {
    // Bresenham line
    let { x: x0, y: y0 } = a;
    let { x: x1, y: y1 } = b;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      const tile = map.getTile(x0, y0);
      if (tile === TILE.GRASS || tile === TILE.SAND) {
        map.roads[map.idx(x0, y0)] = 1;
      }

      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 <  dx) { err += dx; y0 += sy; }
    }
  }

  // -------------------------------------------------------
  // 5. Features
  // -------------------------------------------------------

  _placeFeatures(map) {
    const configs = {
      village:  { count: this.settings.villageCount  ?? 6,  tileFilter: [TILE.GRASS, TILE.FARMLAND], minDist: 15 },
      ruins:    { count: this.settings.ruinsCount    ?? 8,  tileFilter: [TILE.GRASS, TILE.SAND],     minDist: 8  },
      mine:     { count: this.settings.mineCount     ?? 6,  tileFilter: [TILE.MOUNTAIN, TILE.CLIFF], minDist: 10 },
      camp:     { count: this.settings.campCount     ?? 5,  tileFilter: [TILE.FOREST, TILE.GRASS],   minDist: 12 },
      special:  { count: this.settings.specialCount  ?? 2,  tileFilter: [TILE.GRASS],                minDist: 30 },
    };

    for (const [type, cfg] of Object.entries(configs)) {
      this._scatterFeature(map, type, cfg);
    }
  }

  _scatterFeature(map, type, cfg) {
    const placed = [];
    for (let i = 0; i < cfg.count; i++) {
      let found = false;
      for (let attempt = 0; attempt < 80; attempt++) {
        const x = this.rng.nextInt(3, map.width - 3);
        const y = this.rng.nextInt(3, map.height - 3);

        if (!cfg.tileFilter.includes(map.getTile(x, y))) continue;

        // Min distance from same type
        const tooClose = placed.some(p => Math.hypot(p.x - x, p.y - y) < cfg.minDist);
        if (tooClose) continue;

        map.features.push({ type, x, y, data: this._featureData(type) });
        placed.push({ x, y });
        found = true;
        break;
      }
      if (!found) {
        // Relax constraints
        const x = this.rng.nextInt(3, map.width - 3);
        const y = this.rng.nextInt(3, map.height - 3);
        map.features.push({ type, x, y, data: this._featureData(type) });
        placed.push({ x, y });
      }
    }
  }

  _featureData(type) {
    switch (type) {
      case 'mine':    return { resource: this.rng.pick(['iron', 'stone', 'gold']), amount: this.rng.nextInt(200, 800) };
      case 'village': return { population: this.rng.nextInt(50, 200), name: this._randomPlaceName() };
      case 'ruins':   return { loot: this.rng.nextInt(20, 150) };
      case 'camp':    return { strength: this.rng.nextInt(3, 12) };
      case 'special': return { type: this.rng.pick(['oracle', 'shrine', 'wonder']) };
      default:        return {};
    }
  }

  _randomPlaceName() {
    const prefixes = ['Stone', 'Oak', 'River', 'Hill', 'Iron', 'Gold', 'Grey', 'Black', 'White', 'Green'];
    const suffixes = ['ford', 'burg', 'holm', 'dale', 'moor', 'ton', 'field', 'keep', 'haven', 'gate'];
    return this.rng.pick(prefixes) + this.rng.pick(suffixes);
  }

  // -------------------------------------------------------
  // 6. Spawn points
  // -------------------------------------------------------

  _selectSpawnPoints(map) {
    const maxPlayers = this.settings.maxPlayers ?? 4;
    const margin     = Math.max(8, Math.floor(Math.min(map.width, map.height) * 0.1));

    const candidates = [
      { x: margin,              y: margin },
      { x: map.width - margin,  y: margin },
      { x: margin,              y: map.height - margin },
      { x: map.width - margin,  y: map.height - margin },
    ];

    map.spawnPoints = candidates.slice(0, maxPlayers).map(c => {
      // Nudge onto grass
      return this._findNearestGrass(map, c.x, c.y, 10) || c;
    });

    // Connect spawn points with roads
    for (let i = 0; i < map.spawnPoints.length - 1; i++) {
      this._drawRoad(map, map.spawnPoints[i], map.spawnPoints[i + 1]);
    }
  }

  _findNearestGrass(map, cx, cy, radius) {
    for (let r = 0; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = cx + dx, y = cy + dy;
          if (!map.isInBounds(x, y)) continue;
          if (map.getTile(x, y) === TILE.GRASS && map.getBuilding(x, y) === -1) {
            return { x, y };
          }
        }
      }
    }
    return null;
  }

  // -------------------------------------------------------
  // 7. Fog init (everything hidden)
  // -------------------------------------------------------

  _initFog(map) {
    map.fog.fill(0); // all unseen
  }
}
