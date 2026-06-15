import { COMP, TILE_SIZE } from '../constants.js';

/**
 * CombatSystem — C&C-style combat.
 *
 * All non-allied factions are hostile — no diplomatic stance check.
 * Faction hostility is determined by `engine.factionEnemies` map, which is
 * passed in as the `enemies` constructor parameter:
 *   enemies.get(factionId) → Set<factionId>
 *
 * Auto-acquire: non-player units auto-target nearest enemy in sight range.
 * Player units attack only when explicitly ordered.
 * Attack: triggers ProjectileSystem.spawn() for visuals; damage applied immediately.
 * AOE: artillery units deal splash damage within blast radius.
 */
export class CombatSystem {
  constructor(ecs, spatial, projectileSystem, particleSystem, enemies, map = null, pathfinding = null) {
    this.ecs              = ecs;
    this.spatial          = spatial;
    this.projectiles      = projectileSystem;
    this.particles        = particleSystem;
    this.enemies          = enemies; // Map<fId, Set<fId>>
    this.map              = map;
    this.pathfinding      = pathfinding;
    this._pendingDestroy  = [];
  }

  update(dt) {
    const { ecs, spatial } = this;
    this._pendingDestroy.length = 0;

    for (const id of ecs.query(COMP.COMBAT, COMP.POSITION, COMP.FACTION)) {
      const combat  = ecs.getComponent(id, COMP.COMBAT);
      const pos     = ecs.getComponent(id, COMP.POSITION);
      const faction = ecs.getComponent(id, COMP.FACTION);
      const order   = ecs.getComponent(id, COMP.ORDER);
      const attackRate = Math.max(0.1, combat.attackRate ?? 1);
      combat.attackRate = attackRate;
      combat.attackCooldown = Math.max(0, combat.attackCooldown ?? 0);

      // Cool down attack timer
      if (combat.attackCooldown > 0) {
        combat.attackCooldown -= dt;
        if (combat.attackCooldown < 0) combat.attackCooldown = 0;
      }

      if (order?.type === 'attack' && (!combat.targetId || combat.targetId !== order.targetId)) {
        combat.targetId = order.targetId;
      }

      if (combat.targetId && !this._isValidEnemyTarget(id, combat.targetId, faction.id)) {
        combat.targetId = null;
        if (order?.type === 'attack') Object.assign(order, { type: null, targetId: null, approachTile: null });
        continue;
      }

      // Auto-acquire nearest enemy for AI/non-player units only.
      if (!combat.targetId || !ecs.exists(combat.targetId)) {
        if (faction.isPlayer) continue;
        const sightPx = (combat.range ?? 5) * TILE_SIZE * 1.5;
        combat.targetId = this._findTarget(id, pos, faction.id, sightPx);
      }

      if (!combat.targetId) continue;

      const targetPos = ecs.getComponent(combat.targetId, COMP.POSITION);
      if (!targetPos) { combat.targetId = null; continue; }

      const dist      = this._distanceToTarget(id, combat.targetId, pos, targetPos);
      const rangePx   = (combat.range ?? 5) * TILE_SIZE;
      const hasExplicitAttack = order?.type === 'attack' && order.targetId === combat.targetId;
      const sightDropPx = rangePx * 2.5;

      // Drop auto-acquired targets if too far. Explicit player attacks remain locked.
      if (!hasExplicitAttack && dist > sightDropPx) { combat.targetId = null; continue; }

      // Move into range if not there yet (only if unit has movement)
      if (dist > rangePx) {
        const mov = ecs.getComponent(id, COMP.MOVEMENT);
        if (mov && mov.state !== 'moving') {
          const tile = this._findAttackTile(id, combat.targetId, combat);
          if (tile) {
            if (hasExplicitAttack) order.approachTile = tile;
            if (this.pathfinding) {
              this.pathfinding.requestImmediate(id, tile.x, tile.y);
            } else {
              mov.pendingTarget = tile;
              mov.state = 'moving';
            }
          }
        }
        continue;
      }

      // Attack
      if (combat.attackCooldown <= 0) {
        this._attack(id, combat.targetId, combat, pos, targetPos);
        combat.attackCooldown = 1 / attackRate;
      }
    }

    // Flush destroyed entities
    for (const id of this._pendingDestroy) {
      if (ecs.exists(id)) {
        const deathPos = ecs.getComponent(id, COMP.POSITION);
        if (deathPos && this.particles) {
          this.particles.explosion(deathPos.x, deathPos.y, 1.2);
        }
        ecs.emit('entityDestroyed', id);
        ecs.destroyEntity(id);
      }
    }
  }

  _attack(attackerId, targetId, combat, aPos, tPos) {
    const { ecs } = this;

    // Spawn projectile visual
    const projType  = combat.projectileType ?? 'bullet';
    const faction   = ecs.getComponent(attackerId, COMP.FACTION);
    const color     = faction?.color ?? '#ffff00';
    this.projectiles?.spawn(aPos.x, aPos.y, tPos.x, tPos.y, projType, color);

    // Muzzle flash
    const angle = Math.atan2(tPos.y - aPos.y, tPos.x - aPos.x);
    this.particles?.muzzleFlash(aPos.x, aPos.y, angle, color);

    // Apply damage immediately (hit-scan with visual travel)
    const isAOE = (combat.aoeRadius ?? 0) > 0;
    if (isAOE) {
      this._applyAOE(attackerId, tPos, combat);
    } else {
      this._applyDamage(attackerId, targetId, combat.damage ?? 10, combat.armor_piercing ?? 0);
    }
  }

  _distanceToTarget(attackerId, targetId, attackerPos, targetPos) {
    const building = this.ecs.getComponent(targetId, COMP.BUILDING);
    if (!building) return Math.hypot(attackerPos.x - targetPos.x, attackerPos.y - targetPos.y);

    const half = (building.size || 1) * TILE_SIZE * 0.5;
    const dx = Math.max(Math.abs(attackerPos.x - targetPos.x) - half, 0);
    const dy = Math.max(Math.abs(attackerPos.y - targetPos.y) - half, 0);
    return Math.hypot(dx, dy);
  }

  _applyDamage(attackerId, targetId, damage, ap) {
    const { ecs } = this;
    const targetHp = ecs.getComponent(targetId, COMP.HEALTH);
    if (!targetHp) return;
    const armor     = ecs.getComponent(targetId, COMP.COMBAT)?.armor
      ?? ecs.getComponent(targetId, COMP.BUILDING)?.armor
      ?? 0;
    const effective = Math.max(1, damage - Math.max(0, armor - ap));
    targetHp.hp    -= effective;
    if (targetHp.hp <= 0 && !this._pendingDestroy.includes(targetId)) {
      this._pendingDestroy.push(targetId);
    }
  }

  _isValidEnemyTarget(attackerId, targetId, myFactionId) {
    const { ecs } = this;
    if (!ecs.exists(targetId)) return false;
    const hp = ecs.getComponent(targetId, COMP.HEALTH);
    if (!hp || hp.hp <= 0) return false;
    const targetFaction = ecs.getComponent(targetId, COMP.FACTION);
    if (!targetFaction) return false;
    const myEnemies = this.enemies?.get(myFactionId);
    if (myEnemies) return myEnemies.has(targetFaction.id);
    return targetFaction.id !== myFactionId;
  }

  _findAttackTile(attackerId, targetId, combat) {
    const { ecs, map, pathfinding } = this;
    if (!map || !pathfinding) return null;

    const attackerPos = ecs.getComponent(attackerId, COMP.POSITION);
    const targetPos = ecs.getComponent(targetId, COMP.POSITION);
    if (!attackerPos || !targetPos) return null;

    const sx = Math.floor(attackerPos.x / TILE_SIZE);
    const sy = Math.floor(attackerPos.y / TILE_SIZE);
    const tx = Math.floor(targetPos.x / TILE_SIZE);
    const ty = Math.floor(targetPos.y / TILE_SIZE);
    const range = Math.max(1, Math.floor(combat.range ?? 1));
    const searchRadius = Math.max(range + 4, 8);
    const candidates = [];

    for (let y = ty - searchRadius; y <= ty + searchRadius; y++) {
      for (let x = tx - searchRadius; x <= tx + searchRadius; x++) {
        if (!map.isPassable(x, y)) continue;
        const center = { x: (x + 0.5) * TILE_SIZE, y: (y + 0.5) * TILE_SIZE };
        const targetDistance = this._distanceToTarget(attackerId, targetId, center, targetPos) / TILE_SIZE;
        candidates.push({
          x,
          y,
          targetDistance,
          attackerDistance: Math.hypot(x - sx, y - sy),
          inRange: targetDistance <= range,
        });
      }
    }

    candidates.sort((a, b) => {
      if (a.inRange !== b.inRange) return a.inRange ? -1 : 1;
      if (a.inRange) return a.attackerDistance - b.attackerDistance;
      return a.targetDistance - b.targetDistance || a.attackerDistance - b.attackerDistance;
    });

    for (const cand of candidates.slice(0, 48)) {
      const path = pathfinding.astar.find(sx, sy, cand.x, cand.y, 4000);
      if (path) return { x: cand.x, y: cand.y };
    }

    return null;
  }

  _applyAOE(attackerId, center, combat) {
    const { ecs, spatial } = this;
    const radius   = (combat.aoeRadius ?? 2) * TILE_SIZE;
    const nearby   = spatial.queryRadius(center.x, center.y, radius);
    const attFact  = ecs.getComponent(attackerId, COMP.FACTION);
    for (const id of nearby) {
      if (id === attackerId) continue;
      const hp = ecs.getComponent(id, COMP.HEALTH);
      if (!hp) continue;
      const pos  = ecs.getComponent(id, COMP.POSITION);
      const dist = pos ? Math.hypot(pos.x - center.x, pos.y - center.y) : 0;
      const falloff = 1 - (dist / radius) * 0.5;
      this._applyDamage(attackerId, id, Math.floor((combat.damage ?? 10) * falloff), combat.armor_piercing ?? 0);
    }
    this.particles?.explosion(center.x, center.y, (combat.aoeRadius ?? 2) / 2);
  }

  _findTarget(attackerId, pos, myFactionId, sightPx) {
    const { ecs, spatial } = this;
    const myEnemies = this.enemies?.get(myFactionId);
    const nearby    = spatial.queryRadius(pos.x, pos.y, sightPx);
    let best = null, bestDist = Infinity;

    for (const candId of nearby) {
      if (candId === attackerId) continue;
      const candFaction = ecs.getComponent(candId, COMP.FACTION);
      if (!candFaction) continue;
      // In C&C mode: attack if enemy faction OR no enemy map provided (free-for-all)
      if (myEnemies && !myEnemies.has(candFaction.id)) continue;
      if (!myEnemies && candFaction.id === myFactionId) continue;

      const candHp = ecs.getComponent(candId, COMP.HEALTH);
      if (!candHp || candHp.hp <= 0) continue;
      const candPos = ecs.getComponent(candId, COMP.POSITION);
      if (!candPos) continue;

      const d = Math.hypot(pos.x - candPos.x, pos.y - candPos.y);
      if (d < bestDist) { bestDist = d; best = candId; }
    }
    return best;
  }

  /** Force a specific target (player-commanded attack) */
  attackTarget(attackerId, targetId) {
    const combat = this.ecs.getComponent(attackerId, COMP.COMBAT);
    const order = this.ecs.getComponent(attackerId, COMP.ORDER);
    if (combat) {
      combat.targetId = targetId;
      combat.attackRate = Math.max(0.1, combat.attackRate ?? 1);
      combat.attackCooldown = Math.max(0, combat.attackCooldown ?? 0);
    }
    if (order) {
      order.type = 'attack';
      order.targetId = targetId;
      order.approachTile = this._findAttackTile(attackerId, targetId, combat ?? {});
    }

    if (order?.approachTile) {
      this.pathfinding?.requestImmediate(attackerId, order.approachTile.x, order.approachTile.y);
    }
  }
}
