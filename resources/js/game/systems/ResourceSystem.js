// ResourceSystem removed — replaced by HarvesterAI

/**
 * ResourceSystem — handles resource production from buildings (farms, mines, etc.)
 * and resource deposits (forest, mountain nodes on the map).
 */
export class ResourceSystem {
  constructor(ecs, map, factionResources, config) {
    this.ecs              = ecs;
    this.map              = map;
    this.factionResources = factionResources;
    this.config           = config;
    this._tickRate        = TICKS_PER_SECOND; // how often to add production
  }

  update(dt, tick) {
    if (tick % this._tickRate !== 0) return; // once per game-second

    const { ecs } = this;

    for (const id of ecs.query(COMP.BUILDING, COMP.PRODUCTION, COMP.FACTION)) {
      const bld     = ecs.getComponent(id, COMP.BUILDING);
      const prod    = ecs.getComponent(id, COMP.PRODUCTION);
      const faction = ecs.getComponent(id, COMP.FACTION);

      if (bld.buildProgress < 1.0) continue; // still constructing

      const res = this.factionResources[faction.id];
      if (!res) continue;

      const def = this._getBuildingDef(bld.key);
      const production = prod.production || def?.production || {};
      const modifiers  = this._getBonuses(faction.id);

      for (const [resource, baseAmt] of Object.entries(production)) {
        const modifier = modifiers[resource] ?? 1.0;
        const amount   = baseAmt * modifier;
        const maxStore = this._getMaxStorage(resource);
        res[resource]  = Math.min(maxStore, (res[resource] || 0) + amount);
      }
    }

    // Passive food consumption from citizens
    for (const id of ecs.query(COMP.CITIZEN, COMP.FACTION)) {
      const faction = ecs.getComponent(id, COMP.FACTION);
      const res     = this.factionResources[faction.id];
      if (res) res.food = Math.max(0, (res.food || 0) - 0.01);
    }
  }

  _getBuildingDef(key) {
    return (this.config.buildingConfigs || []).find(b => b.key === key);
  }

  _getBonuses(factionEntityId) {
    const fComp = this.ecs.getComponent(factionEntityId, COMP.FACTION);
    return fComp?.bonuses || {};
  }

  _getMaxStorage(resource) {
    const rc = (this.config.resourceConfigs || []).find(r => r.key === resource);
    return rc?.max_storage ?? 99999;
  }

  canAfford(factionEntityId, cost) {
    const res = this.factionResources[factionEntityId];
    if (!res) return false;
    for (const [r, amt] of Object.entries(cost || {})) {
      if ((res[r] || 0) < amt) return false;
    }
    return true;
  }

  deduct(factionEntityId, cost) {
    const res = this.factionResources[factionEntityId];
    if (!res) return;
    for (const [r, amt] of Object.entries(cost || {})) {
      res[r] = Math.max(0, (res[r] || 0) - amt);
    }
  }
}
