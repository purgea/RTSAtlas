/**
 * ProductionSystem — C&C-style building production queues.
 *
 * Each building with a `trains` array has a production queue.
 * Items are deducted from credits immediately on queue.
 * One item produces at a time; power deficit slows all queues.
 * On completion: emits 'unitProduced' with {buildingId, unitKey, factionId, rallyPoint}.
 *
 * Reads directly from project buildingConfigs and unitConfigs.
 */

import { COMP, TICKS_PER_SECOND, POWER_DEFICIT_PENALTY, CREDITS_KEY } from '../constants.js';

export class ProductionSystem {
  constructor(ecs, factionResources, factionPower, config) {
    this.ecs              = ecs;
    this.factionResources = factionResources;
    this.factionPower     = factionPower;    // { [fId]: { supply, drain } }
    this.config           = config;
  }

  update(dt) {
    const { ecs } = this;

    for (const id of ecs.query(COMP.BUILDING, COMP.PRODUCTION, COMP.FACTION)) {
      const prod    = ecs.getComponent(id, COMP.PRODUCTION);
      const bld     = ecs.getComponent(id, COMP.BUILDING);
      const faction = ecs.getComponent(id, COMP.FACTION);

      if (!prod.queue || prod.queue.length === 0) continue;
      if ((bld.buildProgress || 1) < 1.0) continue;  // still constructing

      // Power penalty
      const power = this.factionPower[faction.id] || { supply: 0, drain: 0 };
      const speed = power.drain > power.supply ? POWER_DEFICIT_PENALTY : 1.0;

      prod.progress += dt * speed;

      const item = prod.queue[0];
      const def  = this._getUnitDef(item.unitKey);
      const trainTime = def?.training_time ?? 30;

      if (prod.progress >= trainTime) {
        prod.progress = 0;
        prod.queue.shift();
        ecs.emit('unitProduced', {
          buildingId: id,
          unitKey:    item.unitKey,
          factionId:  faction.id,
          rallyPoint: prod.rallyPoint || null,
        });
      }
    }
  }

  /**
   * Add a unit to a building's production queue.
   * Immediately deducts credits.
   * Returns false if: building can't train it, can't afford it, queue full.
   */
  enqueue(buildingId, unitKey) {
    const { ecs } = this;
    const bld     = ecs.getComponent(buildingId, COMP.BUILDING);
    const prod    = ecs.getComponent(buildingId, COMP.PRODUCTION);
    const faction = ecs.getComponent(buildingId, COMP.FACTION);
    if (!bld || !prod || !faction) return false;

    // Check building can train this unit
    const bldDef = this._getBuildingDef(bld.key);
    if (bldDef?.trains && !bldDef.trains.includes(unitKey)) return false;

    // Queue limit
    if (prod.queue.length >= 5) return false;

    // Credit check
    const def = this._getUnitDef(unitKey);
    if (!def) return false;
    const cost = def.cost?.[CREDITS_KEY] ?? 0;
    const res  = this.factionResources[faction.id];
    if (!res || (res[CREDITS_KEY] || 0) < cost) return false;

    // Deduct credits immediately
    res[CREDITS_KEY] = Math.max(0, (res[CREDITS_KEY] || 0) - cost);

    prod.queue.push({ unitKey, cost });
    return true;
  }

  /**
   * Cancel the last item in the queue. Refund 75%.
   */
  dequeue(buildingId) {
    const { ecs } = this;
    const prod    = ecs.getComponent(buildingId, COMP.PRODUCTION);
    const faction = ecs.getComponent(buildingId, COMP.FACTION);
    if (!prod || prod.queue.length === 0) return;

    const last = prod.queue.pop();
    if (last) {
      const res = this.factionResources[faction.id];
      if (res) res[CREDITS_KEY] = (res[CREDITS_KEY] || 0) + Math.floor((last.cost || 0) * 0.75);
    }
    // Reset progress if we cancelled the active item
    if (prod.queue.length === 0) prod.progress = 0;
  }

  /** Set rally point for a building */
  setRallyPoint(buildingId, tileX, tileY) {
    const prod = this.ecs.getComponent(buildingId, COMP.PRODUCTION);
    if (prod) prod.rallyPoint = { x: tileX, y: tileY };
  }

  /** Get production progress (0..1) for first item in queue */
  getProgress(buildingId) {
    const prod = this.ecs.getComponent(buildingId, COMP.PRODUCTION);
    if (!prod || prod.queue.length === 0) return 0;
    const def = this._getUnitDef(prod.queue[0].unitKey);
    const t   = def?.training_time ?? 30;
    return Math.min(1, prod.progress / t);
  }

  _getUnitDef(key)     { return (this.config.unitConfigs     || []).find(u => u.key === key); }
  _getBuildingDef(key) { return (this.config.buildingConfigs || []).find(b => b.key === key); }
}
