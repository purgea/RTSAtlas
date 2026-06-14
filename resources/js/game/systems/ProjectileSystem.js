/**
 * ProjectileSystem — cosmetic projectiles for visual feedback.
 *
 * Projectiles move from source to target each frame.
 * When they arrive they deal damage and are removed.
 * Artillery projectiles have arc trajectories.
 *
 * This system runs every render tick (called with interpolated alpha),
 * but damage is applied deterministically in CombatSystem.
 */

import { COMP, TILE_SIZE } from '../constants.js';

export class ProjectileSystem {
  constructor(ecs) {
    this.ecs = ecs;
    this._nextId = 1;
    // Store projectiles externally (not in ECS — too many per frame)
    this.projectiles = [];
  }

  /**
   * Spawn a new cosmetic projectile.
   * @param {number}  sx, sy  — source world pixels
   * @param {number}  tx, ty  — target world pixels
   * @param {string}  type    — 'bullet'|'shell'|'rocket'|'orb'
   * @param {string}  color   — faction color
   * @param {number}  damage  — damage to deal on impact (dealt by CombatSystem, not here)
   */
  spawn(sx, sy, tx, ty, type = 'bullet', color = '#ffff00') {
    const dx   = tx - sx, dy = ty - sy;
    const dist = Math.sqrt(dx*dx + dy*dy);

    const speed = type === 'shell' ? 280
               :  type === 'rocket' ? 220
               :  type === 'orb' ? 160
               :  480; // bullet

    this.projectiles.push({
      id:    this._nextId++,
      sx, sy, tx, ty,
      x: sx, y: sy,
      dx: dx / dist, dy: dy / dist,
      speed,
      dist,
      travelled: 0,
      type,
      color,
      done: false,
      arc: type === 'shell' || type === 'rocket',
    });
  }

  update(dt) {
    for (const p of this.projectiles) {
      if (p.done) continue;
      const move    = p.speed * dt;
      p.travelled  += move;
      p.x          += p.dx * move;
      p.y          += p.dy * move;
      if (p.travelled >= p.dist) {
        p.x    = p.tx;
        p.y    = p.ty;
        p.done = true;
        this.ecs.emit('projectileImpact', p);
      }
    }
    // Prune done projectiles
    this.projectiles = this.projectiles.filter(p => !p.done);
  }

  /** Draw all in-flight projectiles onto the given canvas context */
  draw(ctx, camera) {
    for (const p of this.projectiles) {
      const sc = camera.worldToScreen(p.x, p.y);
      ctx.save();
      ctx.globalAlpha = 0.9;

      if (p.type === 'bullet') {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(sc.x, sc.y, 2.5, 0, Math.PI*2); ctx.fill();
        // Trail
        const t = Math.max(0, p.travelled - 8);
        const tx = p.x - p.dx * 8, ty = p.y - p.dy * 8;
        const ts = camera.worldToScreen(tx, ty);
        ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.moveTo(ts.x, ts.y); ctx.lineTo(sc.x, sc.y); ctx.stroke();

      } else if (p.type === 'shell') {
        // Arc offset for artillery shells
        const pct = p.travelled / p.dist;
        const arcH = Math.min(p.dist * 0.25, 120);
        const arcY = -Math.sin(pct * Math.PI) * arcH;
        const asc  = camera.worldToScreen(p.x, p.y + arcY);
        ctx.fillStyle = '#ff8800';
        ctx.beginPath(); ctx.arc(asc.x, asc.y, 3.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffcc00'; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(asc.x, asc.y, 1.5, 0, Math.PI*2); ctx.fill();

      } else if (p.type === 'rocket') {
        ctx.fillStyle = '#ff4400';
        ctx.beginPath(); ctx.arc(sc.x, sc.y, 3, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
        const tx2 = p.x - p.dx * 12, ty2 = p.y - p.dy * 12;
        const ts2  = camera.worldToScreen(tx2, ty2);
        ctx.beginPath(); ctx.moveTo(ts2.x, ts2.y); ctx.lineTo(sc.x, sc.y); ctx.stroke();

      } else { // orb / laser
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(sc.x, sc.y, 3, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();
    }
  }
}
