/**
 * PowerSystem — tracks supply vs drain per faction.
 *
 * Buildings contribute power via `provides.power`:
 *   positive value = supply (power plant)
 *   negative value = drain (barracks, factory, etc.)
 *
 * Results are written into factionPower[fId] = { supply, drain, deficit }.
 * This is read by ProductionSystem for speed penalties.
 *
 * Recalculated every N ticks (not every tick — buildings don't change often).
 */

import { COMP, POWER_KEY } from '../constants.js';

export class PowerSystem {
  constructor(ecs, factionPower, config) {
    this.ecs          = ecs;
    this.factionPower = factionPower;
    this.config       = config;
    this._interval    = 20; // recalculate every 20 ticks (1 second)
  }

  update(dt, tick) {
    if (tick % this._interval !== 0) return;

    const { ecs } = this;
    const totals  = {};

    for (const id of ecs.query(COMP.BUILDING, COMP.FACTION)) {
      const bld     = ecs.getComponent(id, COMP.BUILDING);
      const faction = ecs.getComponent(id, COMP.FACTION);

      if ((bld.buildProgress || 1) < 1.0) continue;

      const def     = (this.config.buildingConfigs || []).find(b => b.key === bld.key);
      const power   = def?.provides?.[POWER_KEY] ?? 0;

      if (!totals[faction.id]) totals[faction.id] = { supply: 0, drain: 0 };
      if (power > 0) totals[faction.id].supply += power;
      else           totals[faction.id].drain  += Math.abs(power);
    }

    // Update the shared factionPower map
    for (const [fId, v] of Object.entries(totals)) {
      this.factionPower[parseInt(fId)] = {
        supply:  v.supply,
        drain:   v.drain,
        deficit: v.drain > v.supply,
      };
    }
  }
}
