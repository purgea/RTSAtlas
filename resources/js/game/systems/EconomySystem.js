// EconomySystem removed — replaced by ProductionSystem

/**
 * EconomySystem — manages building production queues, trade income,
 * population-driven economic activity, and prestige scoring.
 */
export class EconomySystem {
  constructor(ecs, map, factionResources, config) {
    this.ecs              = ecs;
    this.map              = map;
    this.factionResources = factionResources;
    this.config           = config;
  }

  update(dt, tick) {
    const { ecs } = this;

    // Process training queues in barracks / buildings
    for (const id of ecs.query(COMP.BUILDING, COMP.FACTION)) {
      const bld     = ecs.getComponent(id, COMP.BUILDING);
      const faction = ecs.getComponent(id, COMP.FACTION);

      if (!bld.trainQueue || bld.trainQueue.length === 0) continue;
      if (bld.buildProgress < 1.0) continue;

      bld.productionTimer += dt;
      const unitKey = bld.trainQueue[0];
      const unitDef = (this.config.unitConfigs || []).find(u => u.key === unitKey);
      const trainTime = unitDef?.training_time ?? 30;

      if (bld.productionTimer >= trainTime) {
        bld.productionTimer = 0;
        bld.trainQueue.shift();
        ecs.emit('unitTrained', { buildingId: id, unitKey, factionId: faction.id });
      }
    }

    // Market gold income every 60s
    if (tick % (TICKS_PER_SECOND * 60) === 0) {
      this._processTradeIncome();
    }

    // Update prestige score periodically
    if (tick % (TICKS_PER_SECOND * 10) === 0) {
      this._updatePrestige();
    }
  }

  _processTradeIncome() {
    const { ecs } = this;
    for (const id of ecs.query(COMP.BUILDING, COMP.FACTION)) {
      const bld     = ecs.getComponent(id, COMP.BUILDING);
      const faction = ecs.getComponent(id, COMP.FACTION);
      if (bld.key !== 'market' && bld.key !== 'port') continue;

      const res = this.factionResources[faction.id];
      if (!res) continue;

      // Base trade income
      const income = (bld.key === 'market') ? 20 : 35;
      res.gold = (res.gold || 0) + income;
    }
  }

  _updatePrestige() {
    const { ecs } = this;
    // One prestige per 10 citizens, per church, per wonder
    for (const [fId] of Object.entries(this.factionResources)) {
      const fIdNum = parseInt(fId);
      const res    = this.factionResources[fIdNum];
      if (!res) continue;

      const citizens = ecs.query(COMP.CITIZEN, COMP.FACTION)
        .filter(id => ecs.getComponent(id, COMP.FACTION)?.id === fIdNum).length;

      const churches = ecs.query(COMP.BUILDING, COMP.FACTION)
        .filter(id => {
          const b = ecs.getComponent(id, COMP.BUILDING);
          const f = ecs.getComponent(id, COMP.FACTION);
          return f?.id === fIdNum && (b.key === 'church' || b.key === 'cathedral');
        }).length;

      res.prestige = (res.prestige || 0)
        + Math.floor(citizens / 10)
        + churches * 2;
    }
  }

  queueUnit(buildingId, unitKey) {
    const { ecs } = this;
    const bld     = ecs.getComponent(buildingId, COMP.BUILDING);
    const faction = ecs.getComponent(buildingId, COMP.FACTION);
    if (!bld || !faction) return false;

    const unitDef = (this.config.unitConfigs || []).find(u => u.key === unitKey);
    if (!unitDef) return false;

    // Check if building can train this unit
    const bldDef = (this.config.buildingConfigs || []).find(b => b.key === bld.key);
    if (bldDef?.trains && !bldDef.trains.includes(unitKey)) return false;

    // Deduct cost
    const res = this.factionResources[faction.id];
    if (!res) return false;
    for (const [r, amt] of Object.entries(unitDef.cost || {})) {
      if ((res[r] || 0) < amt) return false;
    }
    for (const [r, amt] of Object.entries(unitDef.cost || {})) {
      res[r] = Math.max(0, (res[r] || 0) - amt);
    }

    bld.trainQueue.push(unitKey);
    return true;
  }

  cancelTraining(buildingId, index = 0) {
    const bld     = this.ecs.getComponent(buildingId, COMP.BUILDING);
    const faction = this.ecs.getComponent(buildingId, COMP.FACTION);
    if (!bld || bld.trainQueue.length === 0) return;

    const unitKey = bld.trainQueue.splice(index, 1)[0];
    // Refund 50%
    const unitDef = (this.config.unitConfigs || []).find(u => u.key === unitKey);
    const res     = this.factionResources[faction.id];
    if (res && unitDef) {
      for (const [r, amt] of Object.entries(unitDef.cost || {})) {
        res[r] = (res[r] || 0) + Math.floor(amt * 0.5);
      }
    }
  }
}
