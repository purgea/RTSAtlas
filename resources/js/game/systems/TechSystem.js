// TechSystem removed — tech tree is incompatible with C&C quick-start loop

/**
 * TechSystem — manages technology research queues per faction.
 */
export class TechSystem {
  constructor(ecs, factionResources, config) {
    this.ecs              = ecs;
    this.factionResources = factionResources;
    this.config           = config;
    // Map<factionId, {techKey, timer}>
    this._researchQueues = new Map();
  }

  update(dt) {
    for (const [fId, queue] of this._researchQueues) {
      if (!queue) continue;

      queue.timer += dt;
      const techDef = this._getTechDef(queue.techKey);
      if (!techDef) { this._researchQueues.delete(fId); continue; }

      if (queue.timer >= (techDef.research_time ?? 120)) {
        this._completeTech(parseInt(fId), queue.techKey, techDef);
        this._researchQueues.delete(fId);
      }
    }
  }

  startResearch(factionEntityId, techKey) {
    const fComp = this.ecs.getComponent(factionEntityId, COMP.FACTION);
    if (!fComp) return false;

    const techDef = this._getTechDef(techKey);
    if (!techDef) return false;

    // Already researched?
    if (fComp.techs.includes(techKey)) return false;

    // Prerequisites met?
    const prereqs = techDef.requirements || [];
    if (!prereqs.every(r => fComp.techs.includes(r))) return false;

    // Afford?
    const res = this.factionResources[factionEntityId];
    if (!res) return false;
    for (const [r, amt] of Object.entries(techDef.cost || {})) {
      if ((res[r] || 0) < amt) return false;
    }
    // Deduct
    for (const [r, amt] of Object.entries(techDef.cost || {})) {
      res[r] = Math.max(0, (res[r] || 0) - amt);
    }

    this._researchQueues.set(factionEntityId, { techKey, timer: 0 });
    this.ecs.emit('techStarted', { factionId: factionEntityId, techKey });
    return true;
  }

  getResearchProgress(factionEntityId) {
    const queue   = this._researchQueues.get(factionEntityId);
    if (!queue) return null;
    const techDef = this._getTechDef(queue.techKey);
    return {
      techKey:  queue.techKey,
      progress: queue.timer / (techDef?.research_time ?? 120),
    };
  }

  _completeTech(factionEntityId, techKey, techDef) {
    const { ecs } = this;
    const fComp = ecs.getComponent(factionEntityId, COMP.FACTION);
    if (!fComp) return;

    fComp.techs.push(techKey);
    this._applyEffects(factionEntityId, techDef.effects || {});
    ecs.emit('techCompleted', { factionId: factionEntityId, techKey });
  }

  _applyEffects(factionEntityId, effects) {
    const { ecs } = this;
    const fComp = ecs.getComponent(factionEntityId, COMP.FACTION);
    if (!fComp) return;

    // Resource modifier effects
    if (effects.resource_bonus) {
      fComp.bonuses = fComp.bonuses || {};
      for (const [r, val] of Object.entries(effects.resource_bonus)) {
        fComp.bonuses[r] = (fComp.bonuses[r] || 1) + val;
      }
    }

    // Unit stat effects applied when units are created
    // Diplomacy effects
    if (effects.diplomatic_bonus) {
      ecs.emit('diplomacyChanged', { factionId: factionEntityId, bonus: effects.diplomatic_bonus });
    }
  }

  _getTechDef(key) {
    return (this.config.techConfigs || []).find(t => t.key === key);
  }
}
