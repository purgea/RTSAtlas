/**
 * HarvesterAI — drives harvester units through the collect/deposit cycle.
 *
 * State machine per harvester:
 *   IDLE       → find nearest ore field with ore remaining → MOVE_TO_ORE
 *   MOVE_TO_ORE → arrived at field → HARVESTING
 *   HARVESTING  → timer fills carry amount → MOVE_TO_REFINERY
 *   MOVE_TO_REFINERY → arrived → DEPOSITING → IDLE
 *
 * Ore fields are entities with COMP.ORE_FIELD { amount, maxAmount }.
 * Refineries are buildings that have provides.refinery in config.
 *
 * Credits are added to factionResources[fId].gold when depositing.
 */

import { COMP, TILE_SIZE, CREDITS_KEY, HARVESTER_CARRY, HARVESTER_RATE, HARVESTER_DURATION } from '../constants.js';

const STATE = Object.freeze({
  IDLE:              'idle',
  MOVE_TO_ORE:       'move_to_ore',
  HARVESTING:        'harvesting',
  MOVE_TO_REFINERY:  'move_to_refinery',
  DEPOSITING:        'depositing',
});

export class HarvesterAI {
  constructor(ecs, spatial, factionResources, config) {
    this.ecs              = ecs;
    this.spatial          = spatial;
    this.factionResources = factionResources;
    this.config           = config;
  }

  update(dt, tick) {
    const { ecs } = this;

    for (const id of ecs.query(COMP.HARVESTER, COMP.POSITION, COMP.FACTION, COMP.MOVEMENT)) {
      const harv    = ecs.getComponent(id, COMP.HARVESTER);
      const pos     = ecs.getComponent(id, COMP.POSITION);
      const faction = ecs.getComponent(id, COMP.FACTION);
      const mov     = ecs.getComponent(id, COMP.MOVEMENT);

      switch (harv.state) {

        case STATE.IDLE:
          this._findOreField(id, harv, pos, faction.id);
          break;

        case STATE.MOVE_TO_ORE:
          if (this._arrivedAt(pos, harv.targetPos, TILE_SIZE * 1.2)) {
            mov.path  = [];
            mov.state = 'idle';
            harv.state = STATE.HARVESTING;
            harv.harvestTimer = 0;
          } else if (mov.state === 'idle' && !this._hasPath(mov)) {
            // Re-request path if movement stopped without arriving
            this._requestMove(id, mov, harv.targetPos);
          }
          break;

        case STATE.HARVESTING: {
          const oreField = harv.oreFieldId ? ecs.getComponent(harv.oreFieldId, COMP.ORE_FIELD) : null;
          if (!oreField || oreField.amount <= 0) {
            harv.state = harv.carryAmount > 0 ? STATE.MOVE_TO_REFINERY : STATE.IDLE;
            break;
          }

          harv.harvestTimer += dt;
          const maxCarry   = harv.maxCarry || HARVESTER_CARRY;
          const ratePerSec = HARVESTER_RATE;
          const collected  = Math.min(ratePerSec * dt, oreField.amount, maxCarry - harv.carryAmount);
          oreField.amount  = Math.max(0, oreField.amount - collected);
          harv.carryAmount = Math.min(maxCarry, harv.carryAmount + collected);

          if (harv.carryAmount >= maxCarry || oreField.amount <= 0 || harv.harvestTimer >= HARVESTER_DURATION) {
            harv.state = STATE.MOVE_TO_REFINERY;
            this._findRefinery(id, harv, pos, faction.id);
          }
          break;
        }

        case STATE.MOVE_TO_REFINERY:
          if (this._arrivedAt(pos, harv.depositPos, TILE_SIZE * 2.0)) {
            mov.path  = [];
            mov.state = 'idle';
            harv.state = STATE.DEPOSITING;
            harv.depositTimer = 0;
          } else if (mov.state === 'idle' && !this._hasPath(mov)) {
            if (harv.depositPos) this._requestMove(id, mov, harv.depositPos);
            else harv.state = STATE.IDLE;
          }
          break;

        case STATE.DEPOSITING:
          harv.depositTimer = (harv.depositTimer || 0) + dt;
          if (harv.depositTimer >= 1.5) { // 1.5s deposit animation
            const res = this.factionResources[faction.id];
            if (res) res[CREDITS_KEY] = (res[CREDITS_KEY] || 0) + harv.carryAmount;
            harv.carryAmount  = 0;
            harv.state        = STATE.IDLE;
            harv.oreFieldId   = null;
            harv.depositPos   = null;
          }
          break;
      }
    }

    // Ore field regeneration
    for (const id of ecs.query(COMP.ORE_FIELD)) {
      const field = ecs.getComponent(id, COMP.ORE_FIELD);
      if (field.amount < field.maxAmount) {
        field.amount = Math.min(field.maxAmount, field.amount + field.regenRate * dt);
      }
    }
  }

  _findOreField(harvId, harv, pos, factionId) {
    const { ecs } = this;
    let best = null, bestDist = Infinity;

    for (const fId of ecs.query(COMP.ORE_FIELD, COMP.POSITION)) {
      const field = ecs.getComponent(fId, COMP.ORE_FIELD);
      if (field.amount <= 5) continue;
      const fPos = ecs.getComponent(fId, COMP.POSITION);
      const d    = Math.hypot(pos.x - fPos.x, pos.y - fPos.y);
      if (d < bestDist) { bestDist = d; best = fId; }
    }

    if (!best) return; // no ore — stay idle

    const fieldPos   = ecs.getComponent(best, COMP.POSITION);
    harv.oreFieldId  = best;
    harv.targetPos   = { x: fieldPos.x, y: fieldPos.y };
    harv.state       = STATE.MOVE_TO_ORE;

    const mov = ecs.getComponent(harvId, COMP.MOVEMENT);
    if (mov) this._requestMove(harvId, mov, harv.targetPos);
  }

  _findRefinery(harvId, harv, pos, factionId) {
    const { ecs } = this;
    let best = null, bestDist = Infinity;

    for (const bId of ecs.query(COMP.BUILDING, COMP.FACTION, COMP.POSITION)) {
      const f = ecs.getComponent(bId, COMP.FACTION);
      if (f.id !== factionId) continue;

      const bld = ecs.getComponent(bId, COMP.BUILDING);
      const def = (this.config.buildingConfigs || []).find(b => b.key === bld.key);
      if (!def?.provides?.refinery) continue;

      const bPos = ecs.getComponent(bId, COMP.POSITION);
      const d    = Math.hypot(pos.x - bPos.x, pos.y - bPos.y);
      if (d < bestDist) { bestDist = d; best = bId; }
    }

    if (!best) {
      // No refinery — drop ore
      harv.carryAmount = 0;
      harv.state       = STATE.IDLE;
      return;
    }

    const rPos       = ecs.getComponent(best, COMP.POSITION);
    harv.depositPos  = { x: rPos.x, y: rPos.y };

    const mov = ecs.getComponent(harvId, COMP.MOVEMENT);
    if (mov) this._requestMove(harvId, mov, harv.depositPos);
  }

  _requestMove(entityId, mov, targetPos) {
    mov.pendingTarget = {
      x: Math.floor(targetPos.x / TILE_SIZE),
      y: Math.floor(targetPos.y / TILE_SIZE),
    };
    mov.state = 'moving';
  }

  _arrivedAt(pos, target, threshold) {
    if (!target) return false;
    return Math.hypot(pos.x - target.x, pos.y - target.y) <= threshold;
  }

  _hasPath(mov) {
    return mov.path && mov.path.length > 0 && mov.pathIndex < mov.path.length;
  }
}
