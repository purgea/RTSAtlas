import { COMP, TICKS_PER_SECOND, TILE_SIZE, CREDITS_KEY, categoryToRole, UNIT_ROLE } from '../constants.js';
import { SeededRandom } from '../utils/SeededRandom.js';

/**
 * AISystem — C&C wave-based AI.
 *
 * Per-faction state machine:
 *   ECONOMY  (0-3 min)  → build refinery, spawn harvester, power plant
 *   MILITARY (3-6 min)  → build barracks, train infantry
 *   ASSAULT  (6+ min)   → build war factory, train vehicles, launch attack waves
 *
 * Attack waves every WAVE_INTERVAL seconds. Each wave assembles all idle
 * military units and marches them toward the player's Con Yard.
 *
 * AI reads buildingConfigs and unitConfigs from the project settings.
 */

const WAVE_INTERVAL   = 180; // seconds between waves
const THINK_INTERVAL  = 10;  // seconds between build decisions
const PHASE_ECONOMY   = 'ECONOMY';
const PHASE_MILITARY  = 'MILITARY';
const PHASE_ASSAULT   = 'ASSAULT';

export class AISystem {
  constructor(ecs, map, spatial, factionResources, config, productionSystem, pathfindingSystem, enemies) {
    this.ecs               = ecs;
    this.map               = map;
    this.spatial           = spatial;
    this.factionResources  = factionResources;
    this.config            = config;
    this.productionSystem  = productionSystem;
    this.pathfinding       = pathfindingSystem;
    this.enemies           = enemies; // Map<fId, Set<fId>>
    this._rng              = new SeededRandom(42);
    this._factionState     = new Map(); // fId → { phase, elapsed, nextWave, nextThink }
  }

  update(dt, tick) {
    const { ecs } = this;

    for (const id of ecs.query(COMP.FACTION)) {
      const f = ecs.getComponent(id, COMP.FACTION);
      if (!f || f.isPlayer) continue;

      if (!this._factionState.has(f.id)) {
        this._factionState.set(f.id, {
          phase:      PHASE_ECONOMY,
          elapsed:    0,
          nextWave:   WAVE_INTERVAL,
          nextThink:  THINK_INTERVAL,
        });
      }

      const state = this._factionState.get(f.id);
      state.elapsed   += dt;
      state.nextWave  -= dt;
      state.nextThink -= dt;

      // Phase transitions
      if (state.phase === PHASE_ECONOMY  && state.elapsed >= 180) state.phase = PHASE_MILITARY;
      if (state.phase === PHASE_MILITARY && state.elapsed >= 360) state.phase = PHASE_ASSAULT;

      // Build decisions every THINK_INTERVAL seconds
      if (state.nextThink <= 0) {
        this._think(f.id, state);
        state.nextThink = THINK_INTERVAL + this._rng.nextInt(-2, 4);
      }

      // Launch attack wave
      if (state.nextWave <= 0 && state.phase !== PHASE_ECONOMY) {
        this._launchWave(f.id);
        state.nextWave = WAVE_INTERVAL;
      }
    }
  }

  _think(fId, state) {
    const { config } = this;
    const res    = this.factionResources[fId] || {};
    const credits = res[CREDITS_KEY] || 0;

    switch (state.phase) {

      case PHASE_ECONOMY: {
        // 1. Need a refinery
        if (!this._hasBuildingOfType(fId, 'refinery') && credits >= this._getBuildingCost('refinery')) {
          this._tryBuild(fId, 'refinery', 2);
        }
        // 2. Power plant
        if (!this._hasBuildingOfType(fId, 'power') && credits >= this._getBuildingCost('power')) {
          this._tryBuild(fId, 'power', 2);
        }
        // 3. Spawn harvester from refinery
        this._tryTrainFromBuilding(fId, 'refinery', UNIT_ROLE.HARVESTER);
        break;
      }

      case PHASE_MILITARY: {
        // Economy first
        if (!this._hasBuildingOfType(fId, 'refinery')) {
          this._tryBuild(fId, 'refinery', 2);
        }
        // Build barracks
        if (!this._hasBuildingOfType(fId, 'barracks') && credits >= this._getBuildingCost('barracks')) {
          this._tryBuild(fId, 'barracks', 2);
        }
        // Train infantry
        this._tryTrainFromBuilding(fId, 'barracks', UNIT_ROLE.INFANTRY);
        break;
      }

      case PHASE_ASSAULT: {
        // Keep training
        if (!this._hasBuildingOfType(fId, 'barracks')) this._tryBuild(fId, 'barracks', 2);
        // Try war factory
        if (!this._hasBuildingOfType(fId, 'factory') && credits >= this._getBuildingCost('factory')) {
          this._tryBuild(fId, 'factory', 3);
        }
        this._tryTrainFromBuilding(fId, 'barracks', UNIT_ROLE.INFANTRY);
        this._tryTrainFromBuilding(fId, 'factory', UNIT_ROLE.VEHICLE);
        break;
      }
    }
  }

  _launchWave(fId) {
    const { ecs } = this;
    const targetPos = this._findPlayerConYard();
    if (!targetPos) return;

    const tx = Math.floor(targetPos.x / TILE_SIZE);
    const ty = Math.floor(targetPos.y / TILE_SIZE);

    // Gather idle military units
    const units = ecs.query(COMP.UNIT, COMP.FACTION, COMP.MOVEMENT, COMP.COMBAT)
      .filter(id => {
        const f = ecs.getComponent(id, COMP.FACTION);
        const m = ecs.getComponent(id, COMP.MOVEMENT);
        if (f.id !== fId) return false;
        const role = categoryToRole(ecs.getComponent(id, COMP.UNIT)?.category);
        return role === UNIT_ROLE.INFANTRY || role === UNIT_ROLE.VEHICLE;
      });

    for (const id of units) {
      const mov = ecs.getComponent(id, COMP.MOVEMENT);
      // Spread units slightly around target so they don't stack
      const ox = this._rng.nextInt(-4, 4);
      const oy = this._rng.nextInt(-4, 4);
      mov.pendingTarget = { x: tx + ox, y: ty + oy };
      mov.state = 'moving';
    }
  }

  // -------------------------------------------------------
  // Build helpers
  // -------------------------------------------------------

  _tryBuild(fId, typeHint, size) {
    const bldDef = this._findBuildingDef(typeHint);
    if (!bldDef) return;
    const cost = this._getBuildingCost(typeHint);
    const res  = this.factionResources[fId] || {};
    if ((res[CREDITS_KEY] || 0) < cost) return;

    const pos = this._findBuildPos(fId, size);
    if (!pos) return;

    res[CREDITS_KEY] -= cost;
    this.ecs.emit('aiBuild', { factionId: fId, key: bldDef.key, x: pos.x, y: pos.y });
  }

  _tryTrainFromBuilding(fId, typeHint, role) {
    const { ecs } = this;
    // Find a building that matches the type hint
    const buildings = ecs.query(COMP.BUILDING, COMP.FACTION, COMP.PRODUCTION)
      .filter(id => {
        const f = ecs.getComponent(id, COMP.FACTION);
        const b = ecs.getComponent(id, COMP.BUILDING);
        const p = ecs.getComponent(id, COMP.PRODUCTION);
        if (f.id !== fId) return false;
        if (p.queue.length >= 3) return false;
        return (b.key || '').toLowerCase().includes(typeHint);
      });

    for (const bId of buildings) {
      const prod = ecs.getComponent(bId, COMP.PRODUCTION);
      const bld  = ecs.getComponent(bId, COMP.BUILDING);
      const bldDef = (this.config.buildingConfigs || []).find(b => b.key === bld.key);
      if (!bldDef?.trains?.length) continue;

      // Pick a trainable unit matching the desired role
      const unitKey = bldDef.trains.find(key => {
        const uDef = (this.config.unitConfigs || []).find(u => u.key === key);
        if (!uDef) return false;
        return categoryToRole(uDef.category) === role;
      }) ?? bldDef.trains[0];

      if (unitKey) this.productionSystem?.enqueue(bId, unitKey);
    }
  }

  // -------------------------------------------------------
  // Config lookup helpers
  // -------------------------------------------------------

  _findBuildingDef(typeHint) {
    return (this.config.buildingConfigs || []).find(b => (b.key || '').toLowerCase().includes(typeHint));
  }

  _getBuildingCost(typeHint) {
    const def = this._findBuildingDef(typeHint);
    return def?.cost?.[CREDITS_KEY] ?? 500;
  }

  _hasBuildingOfType(fId, typeHint) {
    return this.ecs.query(COMP.BUILDING, COMP.FACTION).some(id => {
      const f = this.ecs.getComponent(id, COMP.FACTION);
      const b = this.ecs.getComponent(id, COMP.BUILDING);
      return f.id === fId && (b.key || '').toLowerCase().includes(typeHint);
    });
  }

  _findPlayerConYard() {
    const { ecs } = this;
    for (const id of ecs.query(COMP.BUILDING, COMP.FACTION)) {
      const f = ecs.getComponent(id, COMP.FACTION);
      const b = ecs.getComponent(id, COMP.BUILDING);
      if (!f.isPlayer) continue;
      const k = (b.key || '').toLowerCase();
      if (k.includes('con_yard') || k.includes('castle') || k.includes('hq') || k.includes('headquarters')) {
        return ecs.getComponent(id, COMP.POSITION);
      }
    }
    // Fallback: first player unit
    for (const id of ecs.query(COMP.UNIT, COMP.FACTION)) {
      const f = ecs.getComponent(id, COMP.FACTION);
      if (f.isPlayer) return ecs.getComponent(id, COMP.POSITION);
    }
    return null;
  }

  _findBuildPos(fId, size) {
    const { ecs, map } = this;
    // Find AI's con yard / first building as origin
    let origin = null;
    for (const id of ecs.query(COMP.BUILDING, COMP.FACTION)) {
      const f = ecs.getComponent(id, COMP.FACTION);
      if (f.id !== fId) continue;
      const pos = ecs.getComponent(id, COMP.POSITION);
      origin = {
        x: Math.floor(pos.x / TILE_SIZE),
        y: Math.floor(pos.y / TILE_SIZE),
      };
      break;
    }
    if (!origin) origin = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };

    const radius = 12;
    for (let attempt = 0; attempt < 30; attempt++) {
      const tx = origin.x + this._rng.nextInt(-radius, radius);
      const ty = origin.y + this._rng.nextInt(-radius, radius);
      if (tx < 2 || ty < 2 || tx + size >= map.width - 2 || ty + size >= map.height - 2) continue;
      let clear = true;
      for (let dy = 0; dy < size && clear; dy++) {
        for (let dx = 0; dx < size && clear; dx++) {
          if (!map.isPassable(tx+dx, ty+dy) || map.getBuilding(tx+dx, ty+dy) !== -1) {
            clear = false;
          }
        }
      }
      if (clear) return { x: tx, y: ty };
    }
    return null;
  }
}
