/**
 * SpriteCache — generates all unit and building sprites at startup.
 *
 * Sprites are drawn onto OffscreenCanvas objects keyed by
 * `${entityKey}_${factionColor}` so each faction gets its own tint.
 *
 * Every sprite uses ONLY canvas 2D primitives (rectangles, arcs, lines, text).
 * No external image assets required.
 *
 * How shape is chosen:
 *   Buildings → look up key, then category, then draw generic
 *   Units     → look up key, then category (role), then draw generic
 */

import { TILE_SIZE, categoryToRole, UNIT_ROLE } from '../constants.js';

// -------------------------------------------------------
// Colour helpers
// -------------------------------------------------------
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function lighten(hex, amt = 60) {
  const { r, g, b } = hexToRgb(hex);
  const c = v => Math.min(255, v + amt).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function darken(hex, amt = 60) {
  const { r, g, b } = hexToRgb(hex);
  const c = v => Math.max(0, v - amt).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function alpha(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// -------------------------------------------------------
// Sprite cache singleton
// -------------------------------------------------------
export class SpriteCache {
  constructor() {
    this._cache = new Map();
  }

  /**
   * Get or create a sprite canvas for the given entity definition.
   * @param {'unit'|'building'|'ore'} type
   * @param {string} key       — entity key from editor config
   * @param {string} category  — entity category from editor config
   * @param {string} color     — faction hex color
   * @param {number} sizePx    — canvas width/height in pixels
   * @returns {OffscreenCanvas|HTMLCanvasElement}
   */
  get(type, key, category, color, sizePx) {
    const cacheKey = `${type}:${key}:${color}:${sizePx}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const canvas = this._makeCanvas(sizePx, sizePx);
    const ctx    = canvas.getContext('2d');

    if (type === 'unit')     this._drawUnit    (ctx, key, category, color, sizePx);
    else if (type === 'building') this._drawBuilding(ctx, key, category, color, sizePx);
    else if (type === 'ore') this._drawOreField(ctx, color, sizePx);
    this._finishSprite(ctx, type, color, sizePx);

    this._cache.set(cacheKey, canvas);
    return canvas;
  }

  /** Pre-generate sprites for all project configs at load time */
  pregenerate(unitConfigs, buildingConfigs, factions) {
    const factionColors = factions.map(f => f.color || '#4169e1');
    factionColors.push('#888888'); // neutral

    for (const u of unitConfigs) {
      for (const c of factionColors) {
        this.get('unit', u.sprite || u.key, u.category, c, 28);
      }
    }
    for (const b of buildingConfigs) {
      const px = (b.size || 2) * TILE_SIZE;
      for (const c of factionColors) {
        this.get('building', b.sprite || b.key, b.category, c, px);
      }
    }
    // ore field sprite
    this.get('ore', 'ore', 'ore', '#00cc44', 32);
  }

  _makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // -------------------------------------------------------
  // UNIT SPRITES
  // -------------------------------------------------------

  _drawUnit(ctx, key, category, factionColor, size) {
    const role = categoryToRole(category);
    const k    = (key || '').toLowerCase();

    ctx.clearRect(0, 0, size, size);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (role === UNIT_ROLE.HARVESTER || k.includes('harvest') || k.includes('worker')) {
      this._unitHarvester(ctx, factionColor, size);
    } else if (role === UNIT_ROLE.VEHICLE || k.includes('tank') || k.includes('vehicle') || k.includes('knight') || k.includes('siege') || k.includes('artillery') || k.includes('apc')) {
      if (k.includes('artillery') || k.includes('siege') || category === 'siege') {
        this._unitArtillery(ctx, factionColor, size);
      } else if (k.includes('apc') || k.includes('transport')) {
        this._unitAPC(ctx, factionColor, size);
      } else if (k.includes('heavy') || category === 'knight') {
        this._unitHeavyTank(ctx, factionColor, size);
      } else {
        this._unitLightTank(ctx, factionColor, size);
      }
    } else {
      // Infantry variants
      if (k.includes('grenadier') || k.includes('heavy')) {
        this._unitGrenadier(ctx, factionColor, size);
      } else if (k.includes('archer') || k.includes('ranged') || category === 'archer') {
        this._unitArcher(ctx, factionColor, size);
      } else if (k.includes('engineer') || k.includes('medic')) {
        this._unitEngineer(ctx, factionColor, size);
      } else {
        this._unitRifleman(ctx, factionColor, size);
      }
    }
  }

  _unitRifleman(ctx, color, s) {
    const dark = darken(color, 40), light = lighten(color, 60);
    const cx = s / 2, cy = s / 2;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(cx+1, cy+2, s*0.28, s*0.12, 0, 0, Math.PI*2); ctx.fill();
    // Legs
    ctx.strokeStyle = dark; ctx.lineWidth = s*0.10;
    ctx.beginPath(); ctx.moveTo(cx-s*0.08, cy+s*0.12); ctx.lineTo(cx-s*0.10, cy+s*0.38); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+s*0.08, cy+s*0.12); ctx.lineTo(cx+s*0.10, cy+s*0.38); ctx.stroke();
    // Body
    ctx.fillStyle = color;
    ctx.fillRect(cx-s*0.16, cy-s*0.16, s*0.32, s*0.28);
    // Arms + rifle
    ctx.strokeStyle = dark; ctx.lineWidth = s*0.08;
    ctx.beginPath(); ctx.moveTo(cx-s*0.16, cy-s*0.10); ctx.lineTo(cx-s*0.32, cy-s*0.02); ctx.stroke();
    ctx.strokeStyle = '#888';
    ctx.beginPath(); ctx.moveTo(cx+s*0.16, cy-s*0.10); ctx.lineTo(cx+s*0.40, cy-s*0.20); ctx.stroke();
    // Head
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.arc(cx, cy-s*0.26, s*0.14, 0, Math.PI*2); ctx.fill();
    // Helmet
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(cx, cy-s*0.30, s*0.12, Math.PI, 0); ctx.fill();
  }

  _unitArcher(ctx, color, s) {
    const dark = darken(color, 40), light = lighten(color, 60);
    const cx = s/2, cy = s/2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(cx+1, cy+2, s*0.26, s*0.10, 0, 0, Math.PI*2); ctx.fill();
    // Body (slimmer)
    ctx.fillStyle = color;
    ctx.fillRect(cx-s*0.12, cy-s*0.14, s*0.24, s*0.28);
    // Bow
    ctx.strokeStyle = '#8B4513'; ctx.lineWidth = s*0.07;
    ctx.beginPath(); ctx.arc(cx-s*0.28, cy, s*0.22, -Math.PI*0.6, Math.PI*0.6); ctx.stroke();
    // Arrow
    ctx.strokeStyle = '#888'; ctx.lineWidth = s*0.04;
    ctx.beginPath(); ctx.moveTo(cx-s*0.28, cy); ctx.lineTo(cx+s*0.20, cy-s*0.04); ctx.stroke();
    // Head + hood
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.arc(cx, cy-s*0.26, s*0.13, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = darken(color, 20);
    ctx.beginPath(); ctx.arc(cx, cy-s*0.28, s*0.13, Math.PI, 0); ctx.fill();
  }

  _unitGrenadier(ctx, color, s) {
    const dark = darken(color, 40), light = lighten(color, 50);
    const cx = s/2, cy = s/2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(cx+1, cy+2, s*0.30, s*0.12, 0, 0, Math.PI*2); ctx.fill();
    // Chunky body
    ctx.fillStyle = color;
    ctx.fillRect(cx-s*0.20, cy-s*0.18, s*0.40, s*0.34);
    // Grenade (right hand)
    ctx.fillStyle = '#444';
    ctx.beginPath(); ctx.arc(cx+s*0.32, cy-s*0.08, s*0.10, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#777'; ctx.lineWidth = s*0.04;
    ctx.beginPath(); ctx.moveTo(cx+s*0.32, cy-s*0.18); ctx.lineTo(cx+s*0.32, cy-s*0.24); ctx.stroke();
    // Head + helmet
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.arc(cx, cy-s*0.30, s*0.16, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(cx, cy-s*0.32, s*0.18, Math.PI, 0); ctx.fill();
  }

  _unitEngineer(ctx, color, s) {
    const light = lighten(color, 50);
    const cx = s/2, cy = s/2;
    // Body
    ctx.fillStyle = color;
    ctx.fillRect(cx-s*0.14, cy-s*0.14, s*0.28, s*0.30);
    // Wrench
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = s*0.09;
    ctx.beginPath(); ctx.moveTo(cx+s*0.16, cy-s*0.16); ctx.lineTo(cx+s*0.34, cy-s*0.28); ctx.stroke();
    ctx.strokeStyle = '#777'; ctx.lineWidth = s*0.14;
    ctx.beginPath(); ctx.arc(cx+s*0.36, cy-s*0.30, s*0.08, 0, Math.PI*2); ctx.stroke();
    // Hard hat
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.arc(cx, cy-s*0.26, s*0.14, Math.PI, 0, false); ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.arc(cx, cy-s*0.26, s*0.12, 0, Math.PI*2); ctx.fill();
  }

  _unitLightTank(ctx, color, s) {
    const dark = darken(color, 40), light = lighten(color, 40);
    const cx = s/2, cy = s/2;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(cx+1, cy+3, s*0.40, s*0.14, 0, 0, Math.PI*2); ctx.fill();
    // Tracks (left+right)
    ctx.fillStyle = '#333';
    ctx.fillRect(cx-s*0.44, cy-s*0.26, s*0.12, s*0.52);
    ctx.fillRect(cx+s*0.32, cy-s*0.26, s*0.12, s*0.52);
    // Track detail
    ctx.strokeStyle = '#555'; ctx.lineWidth = s*0.03;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(cx-s*0.44, cy-s*0.22+i*s*0.11); ctx.lineTo(cx-s*0.32, cy-s*0.22+i*s*0.11); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+s*0.32, cy-s*0.22+i*s*0.11); ctx.lineTo(cx+s*0.44, cy-s*0.22+i*s*0.11); ctx.stroke();
    }
    // Hull
    ctx.fillStyle = color;
    this._roundRect(ctx, cx-s*0.30, cy-s*0.20, s*0.60, s*0.40, s*0.05);
    ctx.fill();
    // Turret base
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(cx, cy-s*0.02, s*0.16, 0, Math.PI*2); ctx.fill();
    // Gun barrel
    ctx.strokeStyle = dark; ctx.lineWidth = s*0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy-s*0.02); ctx.lineTo(cx+s*0.44, cy-s*0.02); ctx.stroke();
    // Highlight
    ctx.fillStyle = alpha(light, 0.3);
    ctx.fillRect(cx-s*0.28, cy-s*0.18, s*0.28, s*0.10);
  }

  _unitHeavyTank(ctx, color, s) {
    const dark = darken(color, 50), light = lighten(color, 30);
    const cx = s/2, cy = s/2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(cx+2, cy+3, s*0.44, s*0.16, 0, 0, Math.PI*2); ctx.fill();
    // Wider tracks
    ctx.fillStyle = '#222';
    ctx.fillRect(cx-s*0.46, cy-s*0.28, s*0.14, s*0.56);
    ctx.fillRect(cx+s*0.32, cy-s*0.28, s*0.14, s*0.56);
    // Track bolts
    ctx.fillStyle = '#555';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(cx-s*0.39, cy-s*0.18+i*s*0.13, s*0.03, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+s*0.39, cy-s*0.18+i*s*0.13, s*0.03, 0, Math.PI*2); ctx.fill();
    }
    // Wide hull
    ctx.fillStyle = color;
    this._roundRect(ctx, cx-s*0.30, cy-s*0.24, s*0.60, s*0.48, s*0.06);
    ctx.fill();
    // Armour plates
    ctx.strokeStyle = dark; ctx.lineWidth = s*0.03;
    ctx.strokeRect(cx-s*0.28, cy-s*0.22, s*0.56, s*0.44);
    // Large turret
    ctx.fillStyle = darken(color, 30);
    ctx.beginPath(); ctx.arc(cx, cy, s*0.20, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(cx, cy, s*0.12, 0, Math.PI*2); ctx.fill();
    // Long barrel
    ctx.strokeStyle = dark; ctx.lineWidth = s*0.11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx+s*0.48, cy); ctx.stroke();
    // Highlight
    ctx.fillStyle = alpha(light, 0.25);
    ctx.fillRect(cx-s*0.28, cy-s*0.22, s*0.24, s*0.12);
  }

  _unitArtillery(ctx, color, s) {
    const dark = darken(color, 40);
    const cx = s/2, cy = s/2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(cx+1, cy+3, s*0.42, s*0.12, 0, 0, Math.PI*2); ctx.fill();
    // Wheels
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(cx-s*0.28, cy+s*0.18, s*0.12, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+s*0.16, cy+s*0.18, s*0.12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(cx-s*0.28, cy+s*0.18, s*0.06, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+s*0.16, cy+s*0.18, s*0.06, 0, Math.PI*2); ctx.fill();
    // Carriage
    ctx.fillStyle = color;
    this._roundRect(ctx, cx-s*0.36, cy-s*0.10, s*0.60, s*0.26, s*0.04);
    ctx.fill();
    // Very long barrel (angled up)
    ctx.strokeStyle = dark; ctx.lineWidth = s*0.10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx-s*0.04, cy-s*0.06); ctx.lineTo(cx+s*0.46, cy-s*0.28); ctx.stroke();
    // Barrel tip flash guard
    ctx.strokeStyle = '#888'; ctx.lineWidth = s*0.07;
    ctx.beginPath(); ctx.moveTo(cx+s*0.44, cy-s*0.28); ctx.lineTo(cx+s*0.50, cy-s*0.20); ctx.stroke();
  }

  _unitAPC(ctx, color, s) {
    const dark = darken(color, 30);
    const cx = s/2, cy = s/2;
    // Tracks
    ctx.fillStyle = '#333';
    ctx.fillRect(cx-s*0.44, cy-s*0.24, s*0.10, s*0.48);
    ctx.fillRect(cx+s*0.34, cy-s*0.24, s*0.10, s*0.48);
    // Box hull
    ctx.fillStyle = color;
    ctx.fillRect(cx-s*0.32, cy-s*0.26, s*0.64, s*0.46);
    // Side doors
    ctx.strokeStyle = dark; ctx.lineWidth = s*0.03;
    ctx.strokeRect(cx+s*0.04, cy-s*0.22, s*0.22, s*0.36);
    // Hatch on top
    ctx.fillStyle = darken(color, 25);
    ctx.fillRect(cx-s*0.14, cy-s*0.22, s*0.20, s*0.14);
    // Machine gun
    ctx.strokeStyle = '#555'; ctx.lineWidth = s*0.08; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx-s*0.04, cy-s*0.26); ctx.lineTo(cx-s*0.04, cy-s*0.42); ctx.stroke();
  }

  _unitHarvester(ctx, color, s) {
    const dark = darken(color, 30), light = lighten(color, 30);
    const cx = s/2, cy = s/2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(cx+1, cy+3, s*0.42, s*0.14, 0, 0, Math.PI*2); ctx.fill();
    // Wide tracks
    ctx.fillStyle = '#444';
    ctx.fillRect(cx-s*0.44, cy-s*0.20, s*0.12, s*0.42);
    ctx.fillRect(cx+s*0.32, cy-s*0.20, s*0.12, s*0.42);
    // Bulky rounded body
    ctx.fillStyle = color;
    this._roundRect(ctx, cx-s*0.30, cy-s*0.24, s*0.60, s*0.46, s*0.08);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.fillRect(cx-s*0.18, cy-s*0.20, s*0.20, s*0.12);
    // Front scoop
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(cx+s*0.30, cy+s*0.06);
    ctx.lineTo(cx+s*0.46, cy+s*0.14);
    ctx.lineTo(cx+s*0.46, cy+s*0.22);
    ctx.lineTo(cx+s*0.30, cy+s*0.22);
    ctx.closePath(); ctx.fill();
    // Ore indicator (yellow dots)
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(cx, cy-s*0.02, s*0.06, 0, Math.PI*2); ctx.fill();
  }

  // -------------------------------------------------------
  // BUILDING SPRITES
  // -------------------------------------------------------

  _drawBuilding(ctx, key, category, color, size) {
    const k = (key || '').toLowerCase();
    ctx.clearRect(0, 0, size, size);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (k.includes('con_yard') || k.includes('castle') || k.includes('headquarters') || k.includes('hq')) {
      this._bldConYard(ctx, color, size);
    } else if (k.includes('barracks')) {
      this._bldBarracks(ctx, color, size);
    } else if (k.includes('war_factory') || k.includes('factory')) {
      this._bldWarFactory(ctx, color, size);
    } else if (k.includes('refinery')) {
      this._bldRefinery(ctx, color, size);
    } else if (k.includes('power') || k.includes('power_plant')) {
      this._bldPowerPlant(ctx, color, size);
    } else if (k.includes('silo') || k.includes('ore_silo')) {
      this._bldSilo(ctx, color, size);
    } else if (k.includes('radar') || k.includes('dome')) {
      this._bldRadar(ctx, color, size);
    } else if (k.includes('tower') || k.includes('turret') || category === 'defence') {
      this._bldTower(ctx, color, size);
    } else if (k.includes('house') || k.includes('barr')) {
      this._bldBarracks(ctx, color, size);
    } else {
      // Fallback: generic military/economic building
      if (category === 'military') this._bldBarracks(ctx, color, size);
      else if (category === 'economy' || category === 'production') this._bldRefinery(ctx, color, size);
      else this._bldGeneric(ctx, color, size);
    }
  }

  _bldConYard(ctx, color, s) {
    const dark = darken(color, 50), mid = darken(color, 20), light = lighten(color, 40);
    const p = s * 0.06; // padding
    // Foundation
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(p, p, s-p*2, s-p*2);
    // Main structure
    ctx.fillStyle = mid;
    ctx.fillRect(p+s*0.08, p+s*0.08, s-p*2-s*0.16, s-p*2-s*0.16);
    // Outer walls with crenellations
    ctx.fillStyle = color;
    const wallW = s*0.12;
    ctx.fillRect(p, p, wallW, s-p*2);           // left wall
    ctx.fillRect(s-p-wallW, p, wallW, s-p*2);   // right wall
    ctx.fillRect(p, p, s-p*2, wallW);           // top wall
    ctx.fillRect(p, s-p-wallW, s-p*2, wallW);   // bottom wall
    // Corner towers
    ctx.fillStyle = dark;
    const tw = s*0.16;
    ctx.fillRect(p, p, tw, tw);
    ctx.fillRect(s-p-tw, p, tw, tw);
    ctx.fillRect(p, s-p-tw, tw, tw);
    ctx.fillRect(s-p-tw, s-p-tw, tw, tw);
    // Crenellations (top wall)
    ctx.fillStyle = dark;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(p + tw + i * s*0.14, p, s*0.08, s*0.06);
    }
    // Gate
    ctx.fillStyle = '#111';
    ctx.fillRect(s/2-s*0.10, s-p-wallW, s*0.20, wallW);
    // Inner building (con yard crane)
    ctx.fillStyle = light;
    ctx.fillRect(s/2-s*0.12, s/2-s*0.18, s*0.24, s*0.30);
    ctx.fillStyle = dark;
    ctx.fillRect(s/2-s*0.02, s/2-s*0.28, s*0.04, s*0.14);  // crane tower
    ctx.strokeStyle = dark; ctx.lineWidth = s*0.015;
    ctx.beginPath(); ctx.moveTo(s/2, s/2-s*0.28); ctx.lineTo(s/2+s*0.18, s/2-s*0.18); ctx.stroke();
  }

  _bldBarracks(ctx, color, s) {
    const dark = darken(color, 40), light = lighten(color, 30);
    const p = s*0.05;
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(p, p, s-p*2, s-p*2);
    ctx.fillStyle = color;
    ctx.fillRect(p+s*0.06, p+s*0.06, s-p*2-s*0.12, s-p*2-s*0.12);
    // Roof with angled lines
    ctx.fillStyle = dark;
    ctx.fillRect(p+s*0.06, p+s*0.06, s-p*2-s*0.12, s*0.10);
    // Roof lines
    ctx.strokeStyle = darken(dark, 20); ctx.lineWidth = s*0.03;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(p+s*0.12+i*s*0.18, p+s*0.06); ctx.lineTo(p+s*0.12+i*s*0.18, p+s*0.16); ctx.stroke();
    }
    // Door
    ctx.fillStyle = '#111';
    ctx.fillRect(s/2-s*0.08, s-p-s*0.22, s*0.16, s*0.22);
    // Windows
    ctx.fillStyle = '#ffcc66';
    ctx.fillRect(p+s*0.14, s/2-s*0.06, s*0.12, s*0.10);
    ctx.fillRect(s-p-s*0.26, s/2-s*0.06, s*0.12, s*0.10);
    // Flag
    ctx.strokeStyle = '#888'; ctx.lineWidth = s*0.02;
    ctx.beginPath(); ctx.moveTo(s-p-s*0.16, p+s*0.10); ctx.lineTo(s-p-s*0.16, p+s*0.24); ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(s-p-s*0.16, p+s*0.10, s*0.10, s*0.08);
  }

  _bldWarFactory(ctx, color, s) {
    const dark = darken(color, 40), light = lighten(color, 30);
    const p = s*0.04;
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(p, p, s-p*2, s-p*2);
    // Main structure
    ctx.fillStyle = darken(color, 20);
    ctx.fillRect(p+s*0.05, p+s*0.05, s-p*2-s*0.10, s-p*2-s*0.10);
    // Large garage door
    ctx.fillStyle = '#111';
    ctx.fillRect(p+s*0.12, s/2-s*0.04, s*0.44, s*0.40);
    ctx.strokeStyle = '#444'; ctx.lineWidth = s*0.025;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(p+s*0.12, s/2-s*0.04+i*s*0.09); ctx.lineTo(p+s*0.56, s/2-s*0.04+i*s*0.09); ctx.stroke();
    }
    // Roof industrial details
    ctx.fillStyle = dark;
    ctx.fillRect(p+s*0.05, p+s*0.05, s-p*2-s*0.10, s*0.12);
    // Chimneys
    ctx.fillStyle = '#333';
    ctx.fillRect(p+s*0.20, p+s*0.05, s*0.08, s*0.14);
    ctx.fillRect(p+s*0.60, p+s*0.05, s*0.08, s*0.14);
    // Smoke (visual)
    ctx.fillStyle = 'rgba(150,150,150,0.4)';
    ctx.beginPath(); ctx.arc(p+s*0.24, p+s*0.04, s*0.05, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(p+s*0.64, p+s*0.04, s*0.05, 0, Math.PI*2); ctx.fill();
  }

  _bldRefinery(ctx, color, s) {
    const dark = darken(color, 30), light = lighten(color, 40);
    const p = s*0.05;
    ctx.fillStyle = '#2a2200'; ctx.fillRect(p, p, s-p*2, s-p*2);
    // Main building
    ctx.fillStyle = darken(color, 10);
    ctx.fillRect(p+s*0.06, p+s*0.18, s*0.44, s-p*2-s*0.24);
    // Storage tanks
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(s-p-s*0.20, s/2, s*0.18, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#444';
    ctx.beginPath(); ctx.arc(s-p-s*0.20, s/2, s*0.12, 0, Math.PI*2); ctx.fill();
    // Conveyor ramp
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(p+s*0.06, s-p-s*0.06);
    ctx.lineTo(p-s*0.04, s-p+s*0.04);
    ctx.lineTo(p-s*0.04+s*0.28, s-p+s*0.04);
    ctx.lineTo(p+s*0.06+s*0.28, s-p-s*0.06);
    ctx.closePath(); ctx.fill();
    // Roof
    ctx.fillStyle = dark;
    ctx.fillRect(p+s*0.06, p+s*0.18, s*0.44, s*0.10);
    // Ore glow
    ctx.fillStyle = '#ffd700'; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(p+s*0.28, s/2+s*0.08, s*0.08, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  _bldPowerPlant(ctx, color, s) {
    const light = lighten(color, 60);
    const p = s*0.06;
    ctx.fillStyle = '#001a00'; ctx.fillRect(p, p, s-p*2, s-p*2);
    // Dome
    ctx.fillStyle = darken(color, 20);
    ctx.beginPath(); ctx.arc(s/2, s/2+s*0.04, s*0.36, Math.PI, 0); ctx.fill();
    ctx.fillRect(p+s*0.10, s/2, s-p*2-s*0.20, s*0.18);
    // Central glowing reactor
    const grd = ctx.createRadialGradient(s/2, s/2, s*0.04, s/2, s/2, s*0.24);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.3, lighten(color, 80));
    grd.addColorStop(0.7, color);
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(s/2, s/2, s*0.24, 0, Math.PI*2); ctx.fill();
    // Lightning bolts
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s*0.03;
    ctx.beginPath(); ctx.moveTo(s/2, s/2-s*0.18); ctx.lineTo(s/2-s*0.06, s/2); ctx.lineTo(s/2+s*0.04, s/2); ctx.lineTo(s/2-s*0.04, s/2+s*0.18); ctx.stroke();
    // Base lines
    ctx.strokeStyle = color; ctx.lineWidth = s*0.02;
    ctx.strokeRect(p+s*0.08, s/2, s-p*2-s*0.16, s*0.16);
  }

  _bldSilo(ctx, color, s) {
    const dark = darken(color, 40);
    const p = s*0.08;
    ctx.fillStyle = '#1a1500'; ctx.fillRect(p, p, s-p*2, s-p*2);
    // Cylindrical silo
    ctx.fillStyle = darken(color, 10);
    this._roundRect(ctx, p+s*0.08, p+s*0.10, s-p*2-s*0.16, s-p*2-s*0.16, s*0.10);
    ctx.fill();
    // Horizontal rings
    ctx.strokeStyle = dark; ctx.lineWidth = s*0.04;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(p+s*0.08, p+s*0.20+i*s*0.15); ctx.lineTo(s-p-s*0.08, p+s*0.20+i*s*0.15); ctx.stroke();
    }
    // Dome top
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(s/2, p+s*0.14, s*0.30, Math.PI, 0); ctx.fill();
    // Gold fill indicator
    ctx.fillStyle = '#ffd700'; ctx.globalAlpha = 0.5;
    ctx.fillRect(p+s*0.12, s*0.62, s-p*2-s*0.24, s*0.18);
    ctx.globalAlpha = 1;
  }

  _bldRadar(ctx, color, s) {
    const light = lighten(color, 50);
    const p = s*0.06;
    ctx.fillStyle = '#001a1a'; ctx.fillRect(p, p, s-p*2, s-p*2);
    // Base
    ctx.fillStyle = darken(color, 20);
    ctx.fillRect(p+s*0.12, s/2, s-p*2-s*0.24, s/2-p);
    // Dome
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(s/2, s/2, s*0.30, Math.PI, 0); ctx.fill();
    // Dish
    ctx.fillStyle = '#ccc';
    ctx.beginPath(); ctx.arc(s/2, s/2-s*0.04, s*0.22, -Math.PI*0.7, -Math.PI*0.3, false); ctx.fill();
    // Dish arm
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = s*0.03;
    ctx.beginPath(); ctx.moveTo(s/2, s/2); ctx.lineTo(s/2-s*0.10, s/2-s*0.18); ctx.stroke();
    // Scan lines (animated in render, here just static)
    ctx.strokeStyle = alpha(light, 0.6); ctx.lineWidth = s*0.02;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(s/2, s/2, s*(0.10+i*0.08), Math.PI*1.2, Math.PI*1.8); ctx.stroke();
    }
  }

  _bldTower(ctx, color, s) {
    const dark = darken(color, 50);
    const p = s*0.08;
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(p, p, s-p*2, s-p*2);
    // Tower shaft
    ctx.fillStyle = darken(color, 20);
    ctx.fillRect(s/2-s*0.16, p+s*0.28, s*0.32, s-p*2-s*0.34);
    // Reinforcement rings
    ctx.strokeStyle = dark; ctx.lineWidth = s*0.04;
    for (let i = 0; i < 3; i++) {
      ctx.strokeRect(s/2-s*0.16, p+s*0.28+i*s*0.16, s*0.32, s*0.10);
    }
    // Top platform
    ctx.fillStyle = color;
    ctx.fillRect(s/2-s*0.22, p+s*0.20, s*0.44, s*0.12);
    // Gun barrel
    ctx.strokeStyle = dark; ctx.lineWidth = s*0.12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s/2, p+s*0.22); ctx.lineTo(s/2+s*0.38, p+s*0.10); ctx.stroke();
    // Muzzle flash cap
    ctx.fillStyle = '#aaa';
    ctx.beginPath(); ctx.arc(s/2+s*0.38, p+s*0.10, s*0.06, 0, Math.PI*2); ctx.fill();
    // Foundation
    ctx.fillStyle = '#333';
    this._roundRect(ctx, s/2-s*0.24, s-p-s*0.10, s*0.48, s*0.10, s*0.04);
    ctx.fill();
  }

  _bldGeneric(ctx, color, s) {
    const dark = darken(color, 30);
    const p = s*0.06;
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(p, p, s-p*2, s-p*2);
    ctx.fillStyle = color;
    ctx.fillRect(p+s*0.08, p+s*0.08, s-p*2-s*0.16, s-p*2-s*0.16);
    ctx.fillStyle = dark;
    ctx.fillRect(p+s*0.08, p+s*0.08, s-p*2-s*0.16, s*0.10);
    ctx.fillStyle = '#111';
    ctx.fillRect(s/2-s*0.08, s-p-s*0.22, s*0.16, s*0.22);
    ctx.fillStyle = '#ffcc66';
    ctx.fillRect(p+s*0.14, s/2-s*0.05, s*0.10, s*0.08);
    ctx.fillRect(s-p-s*0.24, s/2-s*0.05, s*0.10, s*0.08);
  }

  // -------------------------------------------------------
  // ORE FIELD SPRITE
  // -------------------------------------------------------

  _drawOreField(ctx, color, s) {
    ctx.clearRect(0, 0, s, s);
    const crystalPositions = [
      {x:0.2, y:0.5, r:0.18, angle:0.4},
      {x:0.5, y:0.3, r:0.22, angle:-0.2},
      {x:0.75, y:0.55, r:0.16, angle:0.6},
      {x:0.45, y:0.65, r:0.14, angle:-0.4},
      {x:0.65, y:0.35, r:0.12, angle:0.8},
    ];
    for (const c of crystalPositions) {
      this._drawCrystal(ctx, c.x * s, c.y * s, c.r * s, c.angle, color);
    }
  }

  _finishSprite(ctx, type, color, s) {
    if (type === 'building') {
      this._buildingFinish(ctx, color, s);
    } else if (type === 'unit') {
      this._unitFinish(ctx, color, s);
    } else if (type === 'ore') {
      this._oreFinish(ctx, color, s);
    }
  }

  _buildingFinish(ctx, color, s) {
    const p = s * 0.04;

    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';

    const light = ctx.createLinearGradient(0, 0, s, s);
    light.addColorStop(0, 'rgba(255,255,255,0.22)');
    light.addColorStop(0.45, 'rgba(255,255,255,0.04)');
    light.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, s, s);

    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = 0; i < 5; i++) {
      const x = p + i * s * 0.18;
      ctx.fillRect(x, p, s * 0.025, s - p * 2);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let i = 0; i < 38; i++) {
      const x = (i * 37) % Math.max(1, Math.floor(s));
      const y = (i * 53) % Math.max(1, Math.floor(s));
      ctx.fillRect(x, y, Math.max(1, s * 0.018), Math.max(1, s * 0.018));
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(0,0,0,0.72)';
    ctx.lineWidth = Math.max(2, s * 0.028);
    ctx.strokeRect(p, p, s - p * 2, s - p * 2);

    ctx.strokeStyle = alpha(lighten(color, 90), 0.75);
    ctx.lineWidth = Math.max(1, s * 0.014);
    ctx.strokeRect(p + s * 0.035, p + s * 0.035, s - (p + s * 0.035) * 2, s - (p + s * 0.035) * 2);

    ctx.fillStyle = alpha(color, 0.92);
    ctx.beginPath();
    ctx.moveTo(s * 0.10, s * 0.10);
    ctx.lineTo(s * 0.28, s * 0.10);
    ctx.lineTo(s * 0.10, s * 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _unitFinish(ctx, color, s) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';

    const bevel = ctx.createLinearGradient(0, 0, s, s);
    bevel.addColorStop(0, 'rgba(255,255,255,0.30)');
    bevel.addColorStop(0.35, 'rgba(255,255,255,0.02)');
    bevel.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = bevel;
    ctx.fillRect(0, 0, s, s);

    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(0,0,0,0.58)';
    ctx.lineWidth = Math.max(1.2, s * 0.045);
    ctx.beginPath();
    ctx.ellipse(s / 2, s / 2, s * 0.42, s * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = alpha(lighten(color, 95), 0.95);
    ctx.beginPath();
    ctx.arc(s * 0.33, s * 0.28, Math.max(1.2, s * 0.045), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _oreFinish(ctx, color, s) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const glow = ctx.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s * 0.55);
    glow.addColorStop(0, alpha(lighten(color, 120), 0.85));
    glow.addColorStop(0.55, alpha(color, 0.28));
    glow.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, s, s);
    ctx.restore();
  }

  _drawCrystal(ctx, cx, cy, r, angle, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r*0.5, 0);
    ctx.lineTo(r*0.4, r*0.8);
    ctx.lineTo(-r*0.4, r*0.8);
    ctx.lineTo(-r*0.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = lighten(color, 60); ctx.lineWidth = r*0.08;
    ctx.stroke();
    // Inner highlight
    ctx.fillStyle = alpha(lighten(color, 80), 0.5);
    ctx.beginPath(); ctx.moveTo(0, -r*0.6); ctx.lineTo(r*0.2, 0); ctx.lineTo(0, r*0.3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // -------------------------------------------------------
  // Utility
  // -------------------------------------------------------

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r);
    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h);
    ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
  }
}

export const spriteCache = new SpriteCache();
