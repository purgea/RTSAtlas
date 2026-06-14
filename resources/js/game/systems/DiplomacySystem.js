// DiplomacySystem removed — hostility is faction-team-based in C&C mode

/**
 * DiplomacySystem — manages stance between factions: neutral, allied, war, trade.
 */
export class DiplomacySystem {
  constructor(ecs) {
    this.ecs = ecs;
    // { [factionA_id]: { [factionB_id]: 'neutral'|'allied'|'war'|'trade' } }
    this._stances = {};
    // Relation score -100..+100
    this._relations = {};
  }

  update(dt, tick) {
    // Periodic relation drift (allies drift closer, enemies drift further)
    if (tick % 200 !== 0) return;

    const { ecs } = this;
    const factions = ecs.query(COMP.FACTION).filter(id => {
      const f = ecs.getComponent(id, COMP.FACTION);
      return f && !f.id; // top-level faction entities (not sub-references)
    });

    for (const fA of factions) {
      for (const fB of factions) {
        if (fA >= fB) continue;
        const stance = this.getStance(fA, fB);
        const relKey = `${fA}-${fB}`;
        let rel = this._relations[relKey] ?? 0;

        if (stance === 'allied') rel = Math.min(100, rel + 1);
        if (stance === 'war')    rel = Math.max(-100, rel - 2);

        this._relations[relKey] = rel;

        // Auto-declare war if relation drops below -80
        if (rel <= -80 && stance !== 'war') {
          this.declareWar(fA, fB);
        }
        // Auto-peace if relation recovers above 20 from war
        if (rel >= 20 && stance === 'war') {
          this.setPeace(fA, fB);
        }
      }
    }
  }

  getStance(fA, fB) {
    return this._stances[fA]?.[fB] ?? this._stances[fB]?.[fA] ?? FACTION_STANCE.NEUTRAL;
  }

  setStance(fA, fB, stance) {
    if (!this._stances[fA]) this._stances[fA] = {};
    if (!this._stances[fB]) this._stances[fB] = {};
    this._stances[fA][fB] = stance;
    this._stances[fB][fA] = stance;

    // Mirror to faction components
    const fAComp = this.ecs.getComponent(fA, COMP.FACTION);
    const fBComp = this.ecs.getComponent(fB, COMP.FACTION);
    if (fAComp) fAComp.stance[fB] = stance;
    if (fBComp) fBComp.stance[fA] = stance;

    this.ecs.emit('stanceChanged', { fA, fB, stance });
  }

  declareWar(fA, fB) {
    this.setStance(fA, fB, FACTION_STANCE.WAR);
    this.ecs.emit('warDeclared', { fA, fB });
  }

  setPeace(fA, fB) {
    this.setStance(fA, fB, FACTION_STANCE.NEUTRAL);
    this.ecs.emit('peaceMade', { fA, fB });
  }

  formAlliance(fA, fB) {
    this.setStance(fA, fB, FACTION_STANCE.ALLIED);
    this.ecs.emit('allianceFormed', { fA, fB });
  }

  proposeTrade(fA, fB) {
    this.setStance(fA, fB, FACTION_STANCE.TRADE);
    this.ecs.emit('tradeProposed', { fA, fB });
  }

  adjustRelation(fA, fB, delta) {
    const key = fA < fB ? `${fA}-${fB}` : `${fB}-${fA}`;
    this._relations[key] = Math.max(-100, Math.min(100, (this._relations[key] ?? 0) + delta));
  }

  getRelation(fA, fB) {
    const key = fA < fB ? `${fA}-${fB}` : `${fB}-${fA}`;
    return this._relations[key] ?? 0;
  }

  getIsEnemy(fA, fB) {
    return this.getStance(fA, fB) === FACTION_STANCE.WAR;
  }

  serialize() {
    return { stances: this._stances, relations: this._relations };
  }

  deserialize(d) {
    this._stances   = d.stances   || {};
    this._relations = d.relations || {};
  }
}
