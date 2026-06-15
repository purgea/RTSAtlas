/**
 * Cosmetic projectile state. RenderSystem draws these with PixiJS.
 * CombatSystem applies damage deterministically when attacks are fired.
 */
export class ProjectileSystem {
  constructor(ecs) {
    this.ecs = ecs;
    this._nextId = 1;
    this.projectiles = [];
  }

  spawn(sx, sy, tx, ty, type = 'bullet', color = '#ffff00') {
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const speed = type === 'shell' ? 280
      : type === 'rocket' ? 220
      : type === 'orb' ? 160
      : 480;

    this.projectiles.push({
      id: this._nextId++,
      sx,
      sy,
      tx,
      ty,
      x: sx,
      y: sy,
      dx: dx / dist,
      dy: dy / dist,
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

      const move = p.speed * dt;
      p.travelled += move;
      p.x += p.dx * move;
      p.y += p.dy * move;

      if (p.travelled >= p.dist) {
        p.x = p.tx;
        p.y = p.ty;
        p.done = true;
        this.ecs.emit('projectileImpact', p);
      }
    }

    this.projectiles = this.projectiles.filter(p => !p.done);
  }
}
