import { TILE, TILE_SIZE, TERRAIN_COLOR, COMP } from '../constants.js';
import { spriteCache } from '../sprites/SpriteCache.js';

/**
 * RenderSystem — C&C-style sprite renderer.
 *
 * All entities use procedural sprites from SpriteCache.
 * Rendering order:
 *   1. Terrain tiles (with fog tint)
 *   2. Ore fields (animated crystal glow)
 *   3. Buildings (sprites, health bars, rally point flag, build progress)
 *   4. Units (sprites, selection ring, health bars, facing rotation)
 *   5. Projectiles (ProjectileSystem.draw)
 *   6. Particles (ParticleSystem.draw)
 *   7. Selection rubber-band rect
 *   8. Build preview
 *   9. Minimap (via renderMinimap)
 */
export class RenderSystem {
  constructor(ctx, map, camera, ecs, projectileSystem, particleSystem) {
    this.ctx         = ctx;
    this.map         = map;
    this.camera      = camera;
    this.ecs         = ecs;
    this.projectiles = projectileSystem;
    this.particles   = particleSystem;
    this._oreAnim    = 0; // oscillating glow phase
  }

  render(alpha, dt, selectedEntities, selectionRect, hoverTile, buildMode, moveMarkers = []) {
    const { ctx, map, camera } = this;
    this._oreAnim += dt * 2.0;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();

    this._drawTiles(camera, map);
    this._drawOreFields(selectedEntities);
    this._drawBuildings(selectedEntities);
    this._drawUnits(selectedEntities);
    this._drawMoveMarkers(moveMarkers);
    this.projectiles?.draw(ctx, camera);
    this.particles?.draw(ctx, camera);

    if (hoverTile) this._drawHoverTile(hoverTile);
    if (buildMode) this._drawBuildPreview(hoverTile, buildMode);
    if (selectionRect) this._drawSelectionRect(selectionRect);

    ctx.restore();
  }

  // -------------------------------------------------------
  // Terrain
  // -------------------------------------------------------

  _drawTiles(camera, map) {
    const { ctx } = this;
    const vis = camera.visibleTileRect(map.width, map.height);
    const ts  = TILE_SIZE * camera.zoom;

    for (let y = vis.minY; y < vis.maxY; y++) {
      for (let x = vis.minX; x < vis.maxX; x++) {
        const fog = map.getFog(x, y);
        if (fog === 0) continue;

        const tile = map.getTile(x, y);
        const sc   = camera.tileToScreen(x, y);

        ctx.fillStyle = TERRAIN_COLOR[tile] ?? '#222';
        ctx.fillRect(sc.x, sc.y, ts + 0.5, ts + 0.5);
        this._drawTileDetail(ctx, tile, x, y, sc.x, sc.y, ts);

        if (fog === 1) {
          ctx.fillStyle = 'rgba(0,0,0,0.48)';
          ctx.fillRect(sc.x, sc.y, ts + 0.5, ts + 0.5);
        }
      }
    }
  }

  _drawTileDetail(ctx, tile, tx, ty, sx, sy, ts) {
    const seed = (tx * 73856093) ^ (ty * 19349663) ^ (tile * 83492791);
    const n = Math.abs(seed % 1000) / 1000;

    ctx.save();
    if (tile === TILE.GRASS || tile === TILE.FARMLAND) {
      ctx.strokeStyle = n > 0.5 ? 'rgba(185,215,130,0.18)' : 'rgba(20,55,25,0.18)';
      ctx.lineWidth = Math.max(1, ts * 0.035);
      const blades = 2 + Math.floor(n * 3);
      for (let i = 0; i < blades; i++) {
        const px = sx + ((n * 97 + i * 23) % 1) * ts;
        const py = sy + ((n * 53 + i * 37) % 1) * ts;
        ctx.beginPath();
        ctx.moveTo(px, py + ts * 0.14);
        ctx.lineTo(px + ts * 0.08, py);
        ctx.stroke();
      }
    } else if (tile === TILE.SAND) {
      ctx.strokeStyle = 'rgba(255,235,170,0.16)';
      ctx.lineWidth = Math.max(1, ts * 0.025);
      ctx.beginPath();
      ctx.moveTo(sx + ts * 0.12, sy + ts * (0.25 + n * 0.35));
      ctx.quadraticCurveTo(sx + ts * 0.46, sy + ts * (0.12 + n * 0.18), sx + ts * 0.88, sy + ts * (0.32 + n * 0.25));
      ctx.stroke();
    } else if (tile === TILE.WATER || tile === TILE.DEEP_WATER) {
      ctx.strokeStyle = tile === TILE.DEEP_WATER ? 'rgba(120,170,255,0.16)' : 'rgba(170,220,255,0.22)';
      ctx.lineWidth = Math.max(1, ts * 0.035);
      ctx.beginPath();
      ctx.moveTo(sx + ts * 0.08, sy + ts * (0.35 + n * 0.2));
      ctx.quadraticCurveTo(sx + ts * 0.38, sy + ts * (0.25 + n * 0.2), sx + ts * 0.70, sy + ts * (0.35 + n * 0.2));
      ctx.quadraticCurveTo(sx + ts * 0.86, sy + ts * (0.42 + n * 0.2), sx + ts * 0.96, sy + ts * (0.34 + n * 0.2));
      ctx.stroke();
    } else if (tile === TILE.MOUNTAIN || tile === TILE.CLIFF || tile === TILE.RUINS) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.moveTo(sx + ts * (0.20 + n * 0.18), sy + ts * 0.22);
      ctx.lineTo(sx + ts * (0.46 + n * 0.16), sy + ts * 0.74);
      ctx.lineTo(sx + ts * (0.10 + n * 0.22), sy + ts * 0.68);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath();
      ctx.moveTo(sx + ts * (0.20 + n * 0.18), sy + ts * 0.22);
      ctx.lineTo(sx + ts * (0.32 + n * 0.18), sy + ts * 0.44);
      ctx.lineTo(sx + ts * (0.28 + n * 0.12), sy + ts * 0.48);
      ctx.closePath();
      ctx.fill();
    } else if (tile === TILE.FOREST) {
      ctx.fillStyle = 'rgba(5,30,8,0.30)';
      ctx.beginPath();
      ctx.arc(sx + ts * (0.30 + n * 0.34), sy + ts * (0.32 + n * 0.28), ts * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(95,145,55,0.20)';
      ctx.beginPath();
      ctx.arc(sx + ts * (0.36 + n * 0.26), sy + ts * (0.26 + n * 0.18), ts * 0.10, 0, Math.PI * 2);
      ctx.fill();
    } else if (tile === TILE.SWAMP) {
      ctx.fillStyle = 'rgba(50,85,45,0.35)';
      ctx.beginPath();
      ctx.ellipse(sx + ts * 0.45, sy + ts * (0.52 + n * 0.18), ts * 0.28, ts * 0.10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // -------------------------------------------------------
  // Ore fields
  // -------------------------------------------------------

  _drawOreFields(selectedEntities) {
    const { ctx, ecs, camera } = this;
    const ts = TILE_SIZE * camera.zoom;

    for (const id of ecs.query(COMP.ORE_FIELD, COMP.POSITION)) {
      const pos  = ecs.getComponent(id, COMP.ORE_FIELD);
      const wpos = ecs.getComponent(id, COMP.POSITION);
      const fog  = this.map.getFog(Math.floor(wpos.x / TILE_SIZE), Math.floor(wpos.y / TILE_SIZE));
      if (fog === 0) continue;

      const sc       = camera.worldToScreen(wpos.x, wpos.y);
      const sizePx   = ts * 1.5;
      const sprite   = spriteCache.get('ore', 'ore', 'ore', '#00cc44', 32);

      // Pulsing glow
      const glow = 0.5 + Math.sin(this._oreAnim + id * 1.3) * 0.25;
      ctx.save();
      ctx.globalAlpha = (fog === 1 ? 0.35 : 0.55) * glow;
      ctx.fillStyle   = '#00ff88';
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, sizePx * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = fog === 1 ? 0.4 : 1.0;
      ctx.drawImage(sprite, sc.x - sizePx / 2, sc.y - sizePx / 2, sizePx, sizePx);

      // Amount indicator
      const field = ecs.getComponent(id, COMP.ORE_FIELD);
      if (field && camera.zoom > 0.7) {
        const pct = field.amount / (field.maxAmount || 1);
        ctx.fillStyle   = '#ffd700';
        ctx.font        = `${Math.max(9, ts * 0.22)}px sans-serif`;
        ctx.textAlign   = 'center';
        ctx.textBaseline= 'bottom';
        ctx.fillText(Math.floor(field.amount), sc.x, sc.y - sizePx * 0.55);
      }
      ctx.restore();
    }
  }

  // -------------------------------------------------------
  // Buildings
  // -------------------------------------------------------

  _drawBuildings(selectedEntities) {
    const { ctx, ecs, camera } = this;
    const ts = TILE_SIZE * camera.zoom;

    for (const id of ecs.query(COMP.BUILDING, COMP.POSITION)) {
      const bld     = ecs.getComponent(id, COMP.BUILDING);
      const pos     = ecs.getComponent(id, COMP.POSITION);
      const hp      = ecs.getComponent(id, COMP.HEALTH);
      const faction = ecs.getComponent(id, COMP.FACTION);
      const prod    = ecs.getComponent(id, COMP.PRODUCTION);

      const fog = this.map.getFog(bld.tileX ?? Math.floor(pos.x/TILE_SIZE), bld.tileY ?? Math.floor(pos.y/TILE_SIZE));
      if (fog === 0) continue;

      const sc       = camera.worldToScreen(pos.x, pos.y);
      const sizeTiles = bld.size ?? 2;
      const sizePx   = sizeTiles * ts;
      const color    = faction?.color ?? '#888888';

      // Get or create sprite
      const sprite = spriteCache.get('building', bld.sprite || bld.key, bld.category, color, Math.round(sizeTiles * TILE_SIZE));

      ctx.save();
      if (fog === 1) ctx.globalAlpha = 0.5;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(sc.x - sizePx/2 + 4, sc.y - sizePx/2 + 4, sizePx, sizePx);

      // Sprite
      ctx.drawImage(sprite, sc.x - sizePx/2, sc.y - sizePx/2, sizePx, sizePx);

      ctx.globalAlpha = 1;

      // Selection ring
      if (selectedEntities?.has(id)) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth   = Math.max(2, ts * 0.06);
        ctx.strokeRect(sc.x - sizePx/2 - 2, sc.y - sizePx/2 - 2, sizePx + 4, sizePx + 4);
      }

      // Health bar
      if (hp && hp.hp < hp.maxHp) {
        this._drawHealthBar(ctx, sc.x - sizePx/2, sc.y - sizePx/2 - 6, sizePx, hp.hp / hp.maxHp);
      }

      // Build progress
      if (bld.buildProgress != null && bld.buildProgress < 1.0) {
        this._drawProgressBar(ctx, sc.x - sizePx/2, sc.y + sizePx/2 + 2, sizePx, bld.buildProgress, '#00aaff');
        // Construction overlay
        ctx.fillStyle = 'rgba(0,100,255,0.15)';
        ctx.fillRect(sc.x - sizePx/2, sc.y - sizePx/2, sizePx, sizePx * (1 - bld.buildProgress));
      }

      // Rally point flag
      if (prod?.rallyPoint) {
        const rsc = camera.tileToScreen(prod.rallyPoint.x, prod.rallyPoint.y);
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(sc.x, sc.y + sizePx/2); ctx.lineTo(rsc.x + ts/2, rsc.y + ts/2); ctx.stroke();
        ctx.setLineDash([]);
        // Flag icon
        ctx.fillStyle = color;
        ctx.fillRect(rsc.x + ts/2, rsc.y, ts*0.08, ts*0.3);
        ctx.fillRect(rsc.x + ts/2, rsc.y, ts*0.18, ts*0.12);
      }

      ctx.restore();
    }
  }

  // -------------------------------------------------------
  // Units
  // -------------------------------------------------------

  _drawUnits(selectedEntities) {
    const { ctx, ecs, camera } = this;
    const ts = TILE_SIZE * camera.zoom;

    for (const id of ecs.query(COMP.UNIT, COMP.POSITION)) {
      const unit    = ecs.getComponent(id, COMP.UNIT);
      const pos     = ecs.getComponent(id, COMP.POSITION);
      const hp      = ecs.getComponent(id, COMP.HEALTH);
      const faction = ecs.getComponent(id, COMP.FACTION);
      const mov     = ecs.getComponent(id, COMP.MOVEMENT);

      const tx = Math.floor(pos.x / TILE_SIZE);
      const ty = Math.floor(pos.y / TILE_SIZE);
      const fog = this.map.getFog(tx, ty);
      if (fog === 0) continue;

      const sc      = camera.worldToScreen(pos.x, pos.y);
      const sizePx  = ts * 0.85;
      const color   = faction?.color ?? '#888888';
      const sprite  = spriteCache.get('unit', unit.sprite || unit.key, unit.category, color, 28);

      ctx.save();
      if (fog === 1) ctx.globalAlpha = 0.45;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(sc.x+2, sc.y+sizePx*0.38, sizePx*0.38, sizePx*0.14, 0, 0, Math.PI*2); ctx.fill();

      // Selection ring (behind sprite)
      if (selectedEntities?.has(id)) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth   = 2;
        ctx.beginPath(); ctx.arc(sc.x, sc.y, sizePx * 0.55, 0, Math.PI * 2); ctx.stroke();
        if (fog === 1) ctx.globalAlpha = 0.45;
      }

      // Sprite with rotation based on facing angle
      const angle = mov?.facing ?? 0;
      ctx.translate(sc.x, sc.y);
      ctx.rotate(angle);
      ctx.drawImage(sprite, -sizePx/2, -sizePx/2, sizePx, sizePx);
      ctx.rotate(-angle);
      ctx.translate(-sc.x, -sc.y);

      ctx.globalAlpha = 1;

      // Health bar
      if (hp && hp.hp < hp.maxHp) {
        this._drawHealthBar(ctx, sc.x - sizePx/2, sc.y - sizePx/2 - 5, sizePx, hp.hp / hp.maxHp);
      }

      ctx.restore();
    }
  }

  // -------------------------------------------------------
  // Overlays
  // -------------------------------------------------------

  _drawMoveMarkers(markers) {
    if (!markers?.length) return;

    const { ctx, camera } = this;
    for (const marker of markers) {
      const sc = camera.worldToScreen(marker.x, marker.y);
      const pct = Math.min(1, marker.age / marker.duration);
      const alpha = 1 - pct;
      const size = (18 + pct * 18) * camera.zoom;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#35ff6a';
      ctx.fillStyle = 'rgba(53,255,106,0.18)';
      ctx.lineWidth = Math.max(2, 2.5 * camera.zoom);

      ctx.beginPath();
      ctx.arc(sc.x, sc.y, size * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(sc.x, sc.y - size * 0.62);
      ctx.lineTo(sc.x + size * 0.18, sc.y - size * 0.18);
      ctx.lineTo(sc.x + size * 0.62, sc.y);
      ctx.lineTo(sc.x + size * 0.18, sc.y + size * 0.18);
      ctx.lineTo(sc.x, sc.y + size * 0.62);
      ctx.lineTo(sc.x - size * 0.18, sc.y + size * 0.18);
      ctx.lineTo(sc.x - size * 0.62, sc.y);
      ctx.lineTo(sc.x - size * 0.18, sc.y - size * 0.18);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(sc.x - size * 0.26, sc.y);
      ctx.lineTo(sc.x + size * 0.26, sc.y);
      ctx.moveTo(sc.x, sc.y - size * 0.26);
      ctx.lineTo(sc.x, sc.y + size * 0.26);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawHoverTile(tile) {
    const { ctx, camera } = this;
    const sc = camera.tileToScreen(tile.x, tile.y);
    const ts = TILE_SIZE * camera.zoom;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(sc.x, sc.y, ts, ts);
  }

  _drawBuildPreview(tile, buildMode) {
    if (!tile) return;
    const { ctx, camera } = this;
    const ts   = TILE_SIZE * camera.zoom;
    const size = (buildMode.size ?? 2) * ts;
    const sc   = camera.tileToScreen(tile.x, tile.y);

    // Get sprite for preview
    const color   = buildMode.factionColor ?? '#4169e1';
    const sprite  = spriteCache.get('building', buildMode.sprite || buildMode.key, buildMode.category, color, Math.round(buildMode.size ?? 2) * TILE_SIZE);

    ctx.save();
    ctx.globalAlpha   = 0.65;
    ctx.drawImage(sprite, sc.x, sc.y, size, size);
    ctx.globalAlpha   = 1;
    ctx.strokeStyle   = buildMode.valid ? '#00ff88' : '#ff3300';
    ctx.lineWidth     = 2;
    ctx.strokeRect(sc.x, sc.y, size, size);
    ctx.fillStyle     = buildMode.valid ? 'rgba(0,255,136,0.10)' : 'rgba(255,51,0,0.18)';
    ctx.fillRect(sc.x, sc.y, size, size);
    ctx.restore();
  }

  _drawSelectionRect(rect) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(0,255,136,0.06)';
    ctx.fillRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
    ctx.restore();
  }

  // -------------------------------------------------------
  // Helpers
  // -------------------------------------------------------

  _drawHealthBar(ctx, x, y, width, pct) {
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, width, 4);
    ctx.fillStyle = pct > 0.6 ? '#44dd44' : pct > 0.3 ? '#ddaa00' : '#dd2222';
    ctx.fillRect(x, y, width * pct, 4);
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 0.5;
    ctx.strokeRect(x, y, width, 4);
  }

  _drawProgressBar(ctx, x, y, width, pct, color = '#00aaff') {
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, width, 3);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width * pct, 3);
  }

  // -------------------------------------------------------
  // Minimap
  // -------------------------------------------------------

  renderMinimap(mmCtx, mmW, mmH) {
    const { map, ecs } = this;
    const scaleX = mmW / map.width;
    const scaleY = mmH / map.height;
    const pw = Math.max(1, scaleX);
    const ph = Math.max(1, scaleY);

    // Terrain
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const fog = map.getFog(x, y);
        if (fog === 0) continue;
        const tile = map.getTile(x, y);
        mmCtx.fillStyle = fog === 1 ? '#2a2a2a' : (TERRAIN_COLOR[tile] ?? '#222');
        mmCtx.fillRect(x * scaleX, y * scaleY, pw, ph);
      }
    }

    // Building dots
    for (const id of ecs.query(COMP.BUILDING, COMP.POSITION, COMP.FACTION)) {
      const pos   = ecs.getComponent(id, COMP.POSITION);
      const fact  = ecs.getComponent(id, COMP.FACTION);
      const bld   = ecs.getComponent(id, COMP.BUILDING);
      const fog   = map.getFog(Math.floor(pos.x/TILE_SIZE), Math.floor(pos.y/TILE_SIZE));
      if (fog === 0) continue;
      const sz    = (bld.size ?? 2);
      mmCtx.fillStyle = fact?.color ?? '#888';
      mmCtx.fillRect((pos.x/TILE_SIZE)*scaleX - sz, (pos.y/TILE_SIZE)*scaleY - sz, sz*2*scaleX, sz*2*scaleY);
    }

    // Unit dots
    for (const id of ecs.query(COMP.UNIT, COMP.POSITION, COMP.FACTION)) {
      const pos  = ecs.getComponent(id, COMP.POSITION);
      const fact = ecs.getComponent(id, COMP.FACTION);
      const fog  = map.getFog(Math.floor(pos.x/TILE_SIZE), Math.floor(pos.y/TILE_SIZE));
      if (fog === 0) continue;
      mmCtx.fillStyle = fact?.color ?? '#fff';
      mmCtx.fillRect((pos.x/TILE_SIZE)*scaleX - 1, (pos.y/TILE_SIZE)*scaleY - 1, 2, 2);
    }

    // Viewport rect
    const cam = this.camera;
    const ts  = TILE_SIZE * cam.zoom;
    mmCtx.strokeStyle = 'rgba(255,255,255,0.8)';
    mmCtx.lineWidth   = 1;
    mmCtx.strokeRect(
      (cam.x / ts) * scaleX, (cam.y / ts) * scaleY,
      (cam.width / ts) * scaleX, (cam.height / ts) * scaleY,
    );
  }
}


/**
 * RenderSystem — draws the entire scene to an HTML5 Canvas each frame.
 *
 * Rendering order:
 *  1. Tile layer (terrain)
 *  2. Roads overlay
 *  3. Building entities
 *  4. Unit entities
 *  5. Health bars
 *  6. Selection overlays
 *  7. Selection rubber-band rect
 *  8. Hover tile highlight
 *  9. Build preview
 * 10. HUD overlay (minimap drawn by Vue component)
 */
