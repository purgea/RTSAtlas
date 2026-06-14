/**
 * ParticleSystem — explosion, muzzle flash, and harvest sparkle effects.
 * Runs entirely on the render layer; no game state impact.
 */

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this._nextId   = 1;
  }

  /** Explosion at world position (wx, wy) */
  explosion(wx, wy, scale = 1.0) {
    const count = Math.floor(16 * scale);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = (60 + Math.random() * 80) * scale;
      const color = Math.random() < 0.4 ? '#ff4400' : Math.random() < 0.7 ? '#ffaa00' : '#ffff00';
      this.particles.push({
        id: this._nextId++, wx, wy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.5 + Math.random() * 0.4,
        size: (3 + Math.random() * 4) * scale,
        color, type: 'exp',
      });
    }
    // Smoke ring
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI * 2 * Math.random();
      const speed = 20 + Math.random() * 30;
      this.particles.push({
        id: this._nextId++, wx, wy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.8 + Math.random() * 0.6, maxLife: 1.4,
        size: (6 + Math.random() * 10) * scale,
        color: `rgba(80,80,80,0.5)`, type: 'smoke',
      });
    }
  }

  /** Muzzle flash at world position */
  muzzleFlash(wx, wy, angle, color = '#ffff88') {
    for (let i = 0; i < 6; i++) {
      const spread = (Math.random() - 0.5) * 0.6;
      const speed  = 80 + Math.random() * 60;
      this.particles.push({
        id: this._nextId++, wx, wy,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        life: 0.08 + Math.random() * 0.06,
        maxLife: 0.14,
        size: 2 + Math.random() * 3,
        color, type: 'flash',
      });
    }
  }

  /** Ore harvest sparkle */
  harvestSparkle(wx, wy) {
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI * 2 * Math.random();
      const speed = 15 + Math.random() * 20;
      this.particles.push({
        id: this._nextId++, wx, wy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 30,
        life: 0.6, maxLife: 0.6,
        size: 2 + Math.random() * 2,
        color: '#ffd700', type: 'sparkle',
      });
    }
  }

  /** Building construction dust */
  constructionDust(wx, wy) {
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        id: this._nextId++, wx, wy,
        vx: (Math.random() - 0.5) * 20, vy: -15 - Math.random() * 20,
        life: 0.8, maxLife: 0.8,
        size: 4 + Math.random() * 4,
        color: 'rgba(180,160,100,0.4)', type: 'dust',
      });
    }
  }

  update(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.wx   += p.vx * dt;
      p.wy   += p.vy * dt;
      // Gravity
      if (p.type === 'exp' || p.type === 'smoke') p.vy += 60 * dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  draw(ctx, camera) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      const sc    = camera.worldToScreen(p.wx, p.wy);
      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.type === 'smoke' || p.type === 'dust') {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(sc.x, sc.y, p.size * (1.5 - alpha * 0.5), 0, Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(sc.x, sc.y, p.size * alpha, 0, Math.PI*2); ctx.fill();
      }

      ctx.restore();
    }
  }
}
