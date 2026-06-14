// CitizenSystem removed — replaced by C&C gameplay loop

/**
 * CitizenSystem — simulates citizen needs: hunger, fatigue, morale, health,
 * wealth, sanitation. Affects productivity and population growth.
 */
export class CitizenSystem {
  constructor(ecs, map, factionResources) {
    this.ecs              = ecs;
    this.map              = map;
    this.factionResources = factionResources;
    this._growthTimer     = 0;
  }

  update(dt, tick, gameYear) {
    const { ecs } = this;

    // Update citizen needs every 5 game-seconds
    if (tick % (TICKS_PER_SECOND * 5) !== 0) return;

    for (const id of ecs.query(COMP.CITIZEN, COMP.NEEDS, COMP.FACTION)) {
      const needs   = ecs.getComponent(id, COMP.NEEDS);
      const faction = ecs.getComponent(id, COMP.FACTION);
      const res     = this.factionResources[faction.id] || {};

      // Hunger degrades over time; food consumption
      needs.hunger = Math.max(0, needs.hunger - 0.1);
      if (res.food > 0.5) {
        needs.hunger = Math.min(1.0, needs.hunger + 0.15);
        res.food = Math.max(0, res.food - 0.5);
      }

      // Fatigue
      needs.fatigue = Math.max(0, needs.fatigue - 0.05);

      // Morale influenced by multiple factors
      let moraleDelta = 0;
      if (needs.hunger < 0.3)    moraleDelta -= 0.1;
      if (needs.sanitation < 0.3) moraleDelta -= 0.15;
      if (needs.entertainment > 0.5) moraleDelta += 0.05;
      if (needs.security > 0.6)  moraleDelta += 0.05;
      if (res.faith > 50)        moraleDelta += 0.03;
      needs.morale = Math.max(0, Math.min(1, needs.morale + moraleDelta));

      // Health
      let healthDelta = 0;
      if (needs.sanitation < 0.2) healthDelta -= 0.2; // disease risk
      if (needs.hunger < 0.2)     healthDelta -= 0.1;
      if (needs.morale > 0.7)     healthDelta += 0.05;
      needs.health = Math.max(0, Math.min(1, needs.health + healthDelta));

      // Sanitation decays, buildings restore it
      needs.sanitation = Math.max(0, needs.sanitation - 0.02);

      // If citizen health = 0 → death
      if (needs.health <= 0) {
        ecs.emit('citizenDied', id, faction.id);
        ecs.destroyEntity(id);
        continue;
      }

      // Productivity signal (used by EconomySystem)
      needs.productivity = this._calcProductivity(needs);
    }

    // Apply sanitation from buildings
    this._applySanitationService();

    // Population growth
    this._handleGrowth(dt);
  }

  _calcProductivity(needs) {
    const weights = [
      [needs.hunger,     0.30],
      [needs.morale,     0.25],
      [needs.health,     0.25],
      [1 - needs.fatigue,0.20],
    ];
    return weights.reduce((sum, [val, w]) => sum + val * w, 0);
  }

  _applySanitationService() {
    const { ecs } = this;
    // Buildings with 'sanitation' in provides boost nearby citizen sanitation
    for (const bId of ecs.query(COMP.BUILDING, COMP.PRODUCTION, COMP.POSITION)) {
      const prod = ecs.getComponent(bId, COMP.PRODUCTION);
      if (!prod.provides?.sanitation) continue;

      const bPos = ecs.getComponent(bId, COMP.POSITION);
      const serviceRadius = 8; // tiles

      for (const cId of ecs.query(COMP.CITIZEN, COMP.NEEDS, COMP.POSITION)) {
        const cPos  = ecs.getComponent(cId, COMP.POSITION);
        const dist  = Math.hypot(bPos.x - cPos.x, bPos.y - cPos.y) / 32;
        if (dist <= serviceRadius) {
          const needs = ecs.getComponent(cId, COMP.NEEDS);
          needs.sanitation = Math.min(1, needs.sanitation + 0.08);
        }
      }
    }
  }

  _handleGrowth(dt) {
    this._growthTimer += dt;
    if (this._growthTimer < 60) return; // check every 60 game-seconds
    this._growthTimer = 0;

    const { ecs } = this;
    // Count citizens per faction; if morale high → maybe add one
    const factions = ecs.query(COMP.FACTION).filter(id => {
      return ecs.getComponent(id, COMP.FACTION)?.isPlayer !== undefined;
    });

    for (const fId of factions) {
      const citizens = ecs.query(COMP.CITIZEN, COMP.FACTION).filter(cId => {
        return ecs.getComponent(cId, COMP.FACTION)?.id === fId;
      });

      if (citizens.length === 0) continue;

      const avgMorale = citizens.reduce((sum, cId) => {
        return sum + (ecs.getComponent(cId, COMP.NEEDS)?.morale ?? 0.5);
      }, 0) / citizens.length;

      // House capacity check (each house holds 5 citizens)
      const houses = ecs.query(COMP.BUILDING, COMP.FACTION).filter(bId => {
        const b = ecs.getComponent(bId, COMP.BUILDING);
        const f = ecs.getComponent(bId, COMP.FACTION);
        return b.key === 'house' && f.id === fId;
      });

      const maxCitizens = houses.length * 5;
      if (citizens.length >= maxCitizens) continue;

      // 20% chance of growth per minute if avg morale > 0.6
      if (avgMorale > 0.6 && Math.random() < 0.2) {
        this._spawnCitizen(fId);
      }
    }
  }

  _spawnCitizen(factionEntityId) {
    const { ecs } = this;
    // Find a house to anchor to
    const houses = ecs.query(COMP.BUILDING, COMP.FACTION, COMP.POSITION).filter(id => {
      const b = ecs.getComponent(id, COMP.BUILDING);
      const f = ecs.getComponent(id, COMP.FACTION);
      return b.key === 'house' && f.id === factionEntityId;
    });
    if (!houses.length) return;

    const houseId = houses[Math.floor(Math.random() * houses.length)];
    const housePos = ecs.getComponent(houseId, COMP.POSITION);

    const id = ecs.createEntity('citizen');
    ecs.addComponent(id, COMP.CITIZEN, { homeId: houseId, workId: null, task: 'idle' });
    ecs.addComponent(id, COMP.POSITION, { x: housePos.x + (Math.random() - 0.5) * 64, y: housePos.y + (Math.random() - 0.5) * 64 });
    ecs.addComponent(id, COMP.FACTION,  { id: factionEntityId });
    ecs.addComponent(id, COMP.NEEDS, {
      hunger:       0.8,
      fatigue:      0.2,
      morale:       0.7,
      health:       1.0,
      wealth:       0.2,
      sanitation:   0.5,
      security:     0.5,
      entertainment:0.3,
      productivity: 0.8,
    });
    ecs.addComponent(id, COMP.RENDER, { type: 'citizen', color: '#eecc88', radius: 5, label: 'Citizen' });

    ecs.emit('citizenSpawned', id, factionEntityId);
    return id;
  }
}
