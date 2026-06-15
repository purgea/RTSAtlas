import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
} from 'pixi.js';
import { TILE, TILE_SIZE, TERRAIN_COLOR, COMP } from '../constants.js';
import { spriteCache } from '../sprites/SpriteCache.js';

/**
 * PixiJS renderer for the battlefield.
 *
 * The engine still owns simulation, input, camera math, projectiles, particles,
 * and minimap data. This renderer translates that state into Pixi display
 * objects each frame.
 */
export class RenderSystem {
  constructor(canvas, map, camera, ecs, projectileSystem, particleSystem) {
    this.canvas      = canvas;
    this.map         = map;
    this.camera      = camera;
    this.ecs         = ecs;
    this.projectiles = projectileSystem;
    this.particles   = particleSystem;
    this._oreAnim    = 0;

    this.app = new Application();
    this.stage = new Container();
    this.world = new Container();
    this.overlay = new Container();
    this.stage.addChild(this.world, this.overlay);

    this.layers = {
      terrain: new Graphics(),
      ore: new Container(),
      buildings: new Container(),
      units: new Container(),
      markers: new Graphics(),
      projectiles: new Graphics(),
      particles: new Graphics(),
      hover: new Graphics(),
      preview: new Container(),
      ui: new Graphics(),
    };

    this.world.addChild(
      this.layers.terrain,
      this.layers.ore,
      this.layers.buildings,
      this.layers.units,
      this.layers.markers,
      this.layers.projectiles,
      this.layers.particles,
      this.layers.hover,
      this.layers.preview,
    );
    this.overlay.addChild(this.layers.ui);

    this._textureCache = new Map();
    this._ready = false;
    this._destroyed = false;
    this._pendingSize = null;

    this._readyPromise = this.app.init({
      canvas,
      width: canvas.width,
      height: canvas.height,
      backgroundAlpha: 0,
      antialias: false,
      autoDensity: false,
      resolution: 1,
    }).then(() => {
      if (this._destroyed) return;
      this.app.stage.addChild(this.stage);
      this.app.ticker.stop();
      if (this._pendingSize) {
        this.app.renderer.resize(this._pendingSize.w, this._pendingSize.h);
        this._pendingSize = null;
      }
      this._ready = true;
    });
  }

  render(alpha, dt, selectedEntities, selectionRect, hoverTile, buildMode, moveMarkers = []) {
    if (!this._ready || this._destroyed) return;
    this._oreAnim += dt * 2.0;

    this.world.position.set(-this.camera.x, -this.camera.y);
    this.world.scale.set(this.camera.zoom);

    this._drawTiles();
    this._drawOreFields();
    this._drawBuildings(selectedEntities);
    this._drawUnits(selectedEntities);
    this._drawMoveMarkers(moveMarkers);
    this._drawProjectiles();
    this._drawParticles();
    this._drawHoverAndBuild(hoverTile, buildMode);
    this._drawSelectionRect(selectionRect);

    this.app.renderer.render({ container: this.app.stage });
  }

  resize(w, h) {
    if (this._destroyed) return;
    if (this._ready) this.app.renderer.resize(w, h);
    else this._pendingSize = { w, h };
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.app?.destroy(false);
  }

  _drawTiles() {
    const g = this.layers.terrain;
    const vis = this.camera.visibleTileRect(this.map.width, this.map.height);
    g.clear();

    for (let y = vis.minY; y < vis.maxY; y++) {
      for (let x = vis.minX; x < vis.maxX; x++) {
        const fog = this.map.getFog(x, y);
        if (fog === 0) continue;

        const tile = this.map.getTile(x, y);
        const wx = x * TILE_SIZE;
        const wy = y * TILE_SIZE;
        g.rect(wx, wy, TILE_SIZE + 0.5, TILE_SIZE + 0.5).fill(TERRAIN_COLOR[tile] ?? '#222');
        this._drawTileDetail(g, tile, x, y, wx, wy, TILE_SIZE);

        if (fog === 1) {
          g.rect(wx, wy, TILE_SIZE + 0.5, TILE_SIZE + 0.5).fill({ color: '#000000', alpha: 0.48 });
        }
      }
    }
  }

  _drawTileDetail(g, tile, tx, ty, wx, wy, ts) {
    const seed = (tx * 73856093) ^ (ty * 19349663) ^ (tile * 83492791);
    const n = Math.abs(seed % 1000) / 1000;

    if (tile === TILE.GRASS || tile === TILE.FARMLAND) {
      const color = n > 0.5 ? 'rgba(185,215,130,0.18)' : 'rgba(20,55,25,0.18)';
      const blades = 2 + Math.floor(n * 3);
      for (let i = 0; i < blades; i++) {
        const px = wx + ((n * 97 + i * 23) % 1) * ts;
        const py = wy + ((n * 53 + i * 37) % 1) * ts;
        g.moveTo(px, py + ts * 0.14).lineTo(px + ts * 0.08, py).stroke({ color, width: Math.max(1, ts * 0.035) });
      }
    } else if (tile === TILE.WATER || tile === TILE.DEEP_WATER) {
      const color = tile === TILE.DEEP_WATER ? 'rgba(120,170,255,0.16)' : 'rgba(170,220,255,0.22)';
      g.moveTo(wx + ts * 0.08, wy + ts * (0.35 + n * 0.2))
        .quadraticCurveTo(wx + ts * 0.38, wy + ts * (0.25 + n * 0.2), wx + ts * 0.70, wy + ts * (0.35 + n * 0.2))
        .quadraticCurveTo(wx + ts * 0.86, wy + ts * (0.42 + n * 0.2), wx + ts * 0.96, wy + ts * (0.34 + n * 0.2))
        .stroke({ color, width: Math.max(1, ts * 0.035) });
    } else if (tile === TILE.MOUNTAIN || tile === TILE.CLIFF || tile === TILE.RUINS) {
      g.poly([
        wx + ts * (0.20 + n * 0.18), wy + ts * 0.22,
        wx + ts * (0.46 + n * 0.16), wy + ts * 0.74,
        wx + ts * (0.10 + n * 0.22), wy + ts * 0.68,
      ]).fill({ color: '#000000', alpha: 0.18 });
    } else if (tile === TILE.FOREST) {
      g.circle(wx + ts * (0.30 + n * 0.34), wy + ts * (0.32 + n * 0.28), ts * 0.16)
        .fill({ color: '#051e08', alpha: 0.30 });
      g.circle(wx + ts * (0.36 + n * 0.26), wy + ts * (0.26 + n * 0.18), ts * 0.10)
        .fill({ color: '#5f9137', alpha: 0.20 });
    } else if (tile === TILE.SWAMP) {
      g.ellipse(wx + ts * 0.45, wy + ts * (0.52 + n * 0.18), ts * 0.28, ts * 0.10)
        .fill({ color: '#32552d', alpha: 0.35 });
    }
  }

  _drawOreFields() {
    const layer = this.layers.ore;
    layer.removeChildren();

    for (const id of this.ecs.query(COMP.ORE_FIELD, COMP.POSITION)) {
      const field = this.ecs.getComponent(id, COMP.ORE_FIELD);
      const pos = this.ecs.getComponent(id, COMP.POSITION);
      const fog = this.map.getFog(Math.floor(pos.x / TILE_SIZE), Math.floor(pos.y / TILE_SIZE));
      if (fog === 0) continue;

      const glow = 0.5 + Math.sin(this._oreAnim + id * 1.3) * 0.25;
      const group = new Container();
      group.position.set(pos.x, pos.y);
      group.alpha = fog === 1 ? 0.45 : 1;

      const aura = new Graphics();
      aura.circle(0, 0, TILE_SIZE * 0.9).fill({ color: '#00ff88', alpha: (fog === 1 ? 0.35 : 0.55) * glow });
      group.addChild(aura);

      const ore = new Sprite(this._texture('ore', 'ore', 'ore', '#00cc44', 32));
      ore.anchor.set(0.5);
      ore.width = TILE_SIZE * 1.5;
      ore.height = TILE_SIZE * 1.5;
      group.addChild(ore);

      if (field && this.camera.zoom > 0.7) {
        const text = new Text({
          text: String(Math.floor(field.amount)),
          style: { fill: '#ffd700', fontSize: 9 / this.camera.zoom, fontFamily: 'sans-serif' },
        });
        text.anchor.set(0.5, 1);
        text.position.set(0, -TILE_SIZE * 0.8);
        group.addChild(text);
      }

      layer.addChild(group);
    }
  }

  _drawBuildings(selectedEntities) {
    const layer = this.layers.buildings;
    layer.removeChildren();

    for (const id of this.ecs.query(COMP.BUILDING, COMP.POSITION)) {
      const bld = this.ecs.getComponent(id, COMP.BUILDING);
      const pos = this.ecs.getComponent(id, COMP.POSITION);
      const hp = this.ecs.getComponent(id, COMP.HEALTH);
      const faction = this.ecs.getComponent(id, COMP.FACTION);
      const prod = this.ecs.getComponent(id, COMP.PRODUCTION);
      const fog = this.map.getFog(bld.tileX ?? Math.floor(pos.x / TILE_SIZE), bld.tileY ?? Math.floor(pos.y / TILE_SIZE));
      if (fog === 0) continue;

      const sizeTiles = bld.size ?? 2;
      const sizePx = sizeTiles * TILE_SIZE;
      const color = faction?.color ?? '#888888';
      const group = new Container();
      group.position.set(pos.x, pos.y);
      group.alpha = fog === 1 ? 0.5 : 1;

      const shadow = new Graphics();
      shadow.rect(-sizePx / 2 + 4, -sizePx / 2 + 4, sizePx, sizePx).fill({ color: '#000000', alpha: 0.3 });
      group.addChild(shadow);

      const sprite = new Sprite(this._texture('building', bld.sprite || bld.key, bld.category, color, Math.round(sizeTiles * TILE_SIZE)));
      sprite.anchor.set(0.5);
      sprite.width = sizePx;
      sprite.height = sizePx;
      group.addChild(sprite);

      if (selectedEntities?.has(id)) {
        const sel = new Graphics();
        sel.rect(-sizePx / 2 - 2, -sizePx / 2 - 2, sizePx + 4, sizePx + 4).stroke({ color: '#ffff00', width: 2 / this.camera.zoom });
        group.addChild(sel);
      }

      if (hp && hp.hp < hp.maxHp) group.addChild(this._healthBar(-sizePx / 2, -sizePx / 2 - 6, sizePx, hp.hp / hp.maxHp));

      if (bld.buildProgress != null && bld.buildProgress < 1) {
        group.addChild(this._progressBar(-sizePx / 2, sizePx / 2 + 2, sizePx, bld.buildProgress, '#00aaff'));
        const cover = new Graphics();
        cover.rect(-sizePx / 2, -sizePx / 2, sizePx, sizePx * (1 - bld.buildProgress)).fill({ color: '#0064ff', alpha: 0.15 });
        group.addChild(cover);
      }

      if (prod?.rallyPoint) {
        const rally = new Graphics();
        const rx = (prod.rallyPoint.x + 0.5) * TILE_SIZE - pos.x;
        const ry = (prod.rallyPoint.y + 0.5) * TILE_SIZE - pos.y;
        rally.moveTo(0, sizePx / 2).lineTo(rx, ry).stroke({ color, width: 2 / this.camera.zoom });
        rally.rect(rx, ry - TILE_SIZE * 0.5, TILE_SIZE * 0.08, TILE_SIZE * 0.3).fill(color);
        rally.rect(rx, ry - TILE_SIZE * 0.5, TILE_SIZE * 0.18, TILE_SIZE * 0.12).fill(color);
        group.addChild(rally);
      }

      layer.addChild(group);
    }
  }

  _drawUnits(selectedEntities) {
    const layer = this.layers.units;
    layer.removeChildren();

    for (const id of this.ecs.query(COMP.UNIT, COMP.POSITION)) {
      const unit = this.ecs.getComponent(id, COMP.UNIT);
      const pos = this.ecs.getComponent(id, COMP.POSITION);
      const hp = this.ecs.getComponent(id, COMP.HEALTH);
      const faction = this.ecs.getComponent(id, COMP.FACTION);
      const mov = this.ecs.getComponent(id, COMP.MOVEMENT);
      const fog = this.map.getFog(Math.floor(pos.x / TILE_SIZE), Math.floor(pos.y / TILE_SIZE));
      if (fog === 0) continue;

      const sizePx = TILE_SIZE * 0.85;
      const color = faction?.color ?? '#888888';
      const group = new Container();
      group.position.set(pos.x, pos.y);
      group.alpha = fog === 1 ? 0.45 : 1;

      const shadow = new Graphics();
      shadow.ellipse(2, sizePx * 0.38, sizePx * 0.38, sizePx * 0.14).fill({ color: '#000000', alpha: 0.22 });
      group.addChild(shadow);

      if (selectedEntities?.has(id)) {
        const sel = new Graphics();
        sel.circle(0, 0, sizePx * 0.55).stroke({ color: '#ffff00', width: 2 / this.camera.zoom });
        group.addChild(sel);
      }

      const sprite = new Sprite(this._texture('unit', unit.sprite || unit.key, unit.category, color, 28));
      sprite.anchor.set(0.5);
      sprite.width = sizePx;
      sprite.height = sizePx;
      sprite.rotation = mov?.facing ?? 0;
      group.addChild(sprite);

      if (hp && hp.hp < hp.maxHp) group.addChild(this._healthBar(-sizePx / 2, -sizePx / 2 - 5, sizePx, hp.hp / hp.maxHp));
      layer.addChild(group);
    }
  }

  _drawMoveMarkers(markers) {
    const g = this.layers.markers;
    g.clear();
    if (!markers?.length) return;

    for (const marker of markers) {
      const pct = Math.min(1, marker.age / marker.duration);
      const alpha = 1 - pct;

      if (marker.type === 'attack') {
        this._drawAttackMarker(g, marker.x, marker.y, pct, alpha);
      } else {
        this._drawMoveMarker(g, marker.x, marker.y, pct, alpha);
      }
    }
  }

  _drawMoveMarker(g, x, y, pct, alpha) {
    const bob = Math.sin(pct * Math.PI) * 8;
    const size = 18 + pct * 5;
    const top = y - 30 + bob;
    const color = '#35ff6a';
    const width = Math.max(1.5, 2 / this.camera.zoom);

    g.circle(x, y, 11 + pct * 8)
      .stroke({ color, alpha: 0.45 * alpha, width: 1.5 / this.camera.zoom });
    g.moveTo(x, top)
      .lineTo(x, top + size)
      .stroke({ color, alpha, width: Math.max(3, 4 / this.camera.zoom) });
    g.poly([
      x, top + size + 9,
      x - size * 0.45, top + size - 3,
      x + size * 0.45, top + size - 3,
    ]).fill({ color, alpha }).stroke({ color: '#b7ffd0', alpha: 0.65 * alpha, width });
  }

  _drawAttackMarker(g, x, y, pct, alpha) {
    const color = '#ff2d2d';
    const flash = 0.85 + Math.sin(pct * Math.PI) * 0.25;
    const size = 28 * flash;
    const width = Math.max(1.5, 2 / this.camera.zoom);
    const angle = -Math.PI / 4;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const px = -uy;
    const py = ux;
    const tipX = x + ux * size * 0.65;
    const tipY = y + uy * size * 0.65;
    const baseX = x - ux * size * 0.18;
    const baseY = y - uy * size * 0.18;
    const pommelX = x - ux * size * 0.58;
    const pommelY = y - uy * size * 0.58;

    g.circle(x, y, 16 + pct * 9)
      .stroke({ color, alpha: 0.35 * alpha, width: 1.5 / this.camera.zoom });
    g.poly([
      tipX, tipY,
      baseX + px * size * 0.10, baseY + py * size * 0.10,
      baseX - px * size * 0.10, baseY - py * size * 0.10,
    ]).fill({ color: '#f4f4f4', alpha }).stroke({ color, alpha, width });
    g.moveTo(baseX + px * size * 0.28, baseY + py * size * 0.28)
      .lineTo(baseX - px * size * 0.28, baseY - py * size * 0.28)
      .stroke({ color, alpha, width: Math.max(2, 3 / this.camera.zoom) });
    g.moveTo(baseX, baseY)
      .lineTo(pommelX, pommelY)
      .stroke({ color: '#7a1818', alpha, width: Math.max(3, 4 / this.camera.zoom) });
    g.circle(pommelX, pommelY, Math.max(2, size * 0.07))
      .fill({ color, alpha });
  }

  _drawProjectiles() {
    const g = this.layers.projectiles;
    g.clear();

    for (const p of this.projectiles?.projectiles ?? []) {
      if (p.type === 'bullet') {
        g.circle(p.x, p.y, 2.5 / this.camera.zoom).fill({ color: p.color, alpha: 0.9 });
        g.moveTo(p.x - p.dx * 8, p.y - p.dy * 8).lineTo(p.x, p.y).stroke({ color: p.color, alpha: 0.4, width: 1.5 / this.camera.zoom });
      } else if (p.type === 'shell') {
        const pct = p.travelled / p.dist;
        const arcY = -Math.sin(pct * Math.PI) * Math.min(p.dist * 0.25, 120);
        g.circle(p.x, p.y + arcY, 3.5 / this.camera.zoom).fill('#ff8800');
        g.circle(p.x, p.y + arcY, 1.5 / this.camera.zoom).fill({ color: '#ffcc00', alpha: 0.6 });
      } else {
        g.circle(p.x, p.y, 3 / this.camera.zoom).fill(p.color ?? '#ff4400');
      }
    }
  }

  _drawParticles() {
    const g = this.layers.particles;
    g.clear();

    for (const p of this.particles?.particles ?? []) {
      const alpha = Math.max(0, p.life / p.maxLife);
      const size = (p.type === 'smoke' || p.type === 'dust') ? p.size * (1.5 - alpha * 0.5) : p.size * alpha;
      g.circle(p.wx, p.wy, size / this.camera.zoom).fill({ color: p.color, alpha });
    }
  }

  _drawHoverAndBuild(tile, buildMode) {
    const g = this.layers.hover;
    const preview = this.layers.preview;
    g.clear();
    preview.removeChildren();
    if (tile) {
      g.rect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        .stroke({ color: '#ffffff', alpha: 0.5, width: 1 / this.camera.zoom });
    }

    if (!tile || !buildMode) return;
    const size = (buildMode.size ?? 2) * TILE_SIZE;
    const x = tile.x * TILE_SIZE;
    const y = tile.y * TILE_SIZE;
    const color = buildMode.factionColor ?? '#4169e1';
    const sprite = new Sprite(this._texture('building', buildMode.sprite || buildMode.key, buildMode.category, color, Math.round(buildMode.size ?? 2) * TILE_SIZE));
    sprite.position.set(x, y);
    sprite.width = size;
    sprite.height = size;
    sprite.alpha = 0.65;

    preview.addChild(sprite);
    g.rect(x, y, size, size)
      .fill({ color: buildMode.valid ? '#00ff88' : '#ff3300', alpha: buildMode.valid ? 0.10 : 0.18 })
      .stroke({ color: buildMode.valid ? '#00ff88' : '#ff3300', width: 2 / this.camera.zoom });
  }

  _drawSelectionRect(rect) {
    const g = this.layers.ui;
    g.clear();
    if (!rect) return;
    g.rect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1)
      .fill({ color: '#00ff88', alpha: 0.06 })
      .stroke({ color: '#00ff88', width: 1 });
  }

  _healthBar(x, y, width, pct) {
    const g = new Graphics();
    const color = pct > 0.6 ? '#44dd44' : pct > 0.3 ? '#ddaa00' : '#dd2222';
    g.rect(x, y, width, 4).fill('#222222');
    g.rect(x, y, width * pct, 4).fill(color);
    g.rect(x, y, width, 4).stroke({ color: '#000000', width: 0.5 / this.camera.zoom });
    return g;
  }

  _progressBar(x, y, width, pct, color = '#00aaff') {
    const g = new Graphics();
    g.rect(x, y, width, 3).fill('#222222');
    g.rect(x, y, width * pct, 3).fill(color);
    return g;
  }

  _texture(type, key, category, color, sizePx) {
    const cacheKey = `${type}:${key}:${category}:${color}:${sizePx}`;
    if (!this._textureCache.has(cacheKey)) {
      this._textureCache.set(cacheKey, Texture.from(spriteCache.get(type, key, category, color, sizePx)));
    }
    return this._textureCache.get(cacheKey);
  }

  renderMinimap(mmCtx, mmW, mmH) {
    const { map, ecs } = this;
    const scaleX = mmW / map.width;
    const scaleY = mmH / map.height;
    const pw = Math.max(1, scaleX);
    const ph = Math.max(1, scaleY);

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const fog = map.getFog(x, y);
        if (fog === 0) continue;
        const tile = map.getTile(x, y);
        mmCtx.fillStyle = fog === 1 ? '#2a2a2a' : (TERRAIN_COLOR[tile] ?? '#222');
        mmCtx.fillRect(x * scaleX, y * scaleY, pw, ph);
      }
    }

    for (const id of ecs.query(COMP.BUILDING, COMP.POSITION, COMP.FACTION)) {
      const pos = ecs.getComponent(id, COMP.POSITION);
      const fact = ecs.getComponent(id, COMP.FACTION);
      const bld = ecs.getComponent(id, COMP.BUILDING);
      const fog = map.getFog(Math.floor(pos.x / TILE_SIZE), Math.floor(pos.y / TILE_SIZE));
      if (fog === 0) continue;
      const sz = bld.size ?? 2;
      mmCtx.fillStyle = fact?.color ?? '#888';
      mmCtx.fillRect((pos.x / TILE_SIZE) * scaleX - sz, (pos.y / TILE_SIZE) * scaleY - sz, sz * 2 * scaleX, sz * 2 * scaleY);
    }

    for (const id of ecs.query(COMP.UNIT, COMP.POSITION, COMP.FACTION)) {
      const pos = ecs.getComponent(id, COMP.POSITION);
      const fact = ecs.getComponent(id, COMP.FACTION);
      const fog = map.getFog(Math.floor(pos.x / TILE_SIZE), Math.floor(pos.y / TILE_SIZE));
      if (fog === 0) continue;
      mmCtx.fillStyle = fact?.color ?? '#fff';
      mmCtx.fillRect((pos.x / TILE_SIZE) * scaleX - 1, (pos.y / TILE_SIZE) * scaleY - 1, 2, 2);
    }

    const cam = this.camera;
    const ts = TILE_SIZE * cam.zoom;
    mmCtx.strokeStyle = 'rgba(255,255,255,0.8)';
    mmCtx.lineWidth = 1;
    mmCtx.strokeRect((cam.x / ts) * scaleX, (cam.y / ts) * scaleY, (cam.width / ts) * scaleX, (cam.height / ts) * scaleY);
  }
}
