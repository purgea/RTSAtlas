import { TILE_SIZE } from '../constants.js';

/**
 * Camera manages the viewport pan and zoom over the tile world.
 */
export class Camera {
  constructor(canvasWidth, canvasHeight) {
    this.x      = 0;          // world pixel origin visible at top-left
    this.y      = 0;
    this.zoom   = 1.0;        // scale factor
    this.width  = canvasWidth;
    this.height = canvasHeight;
    this._minZoom = 0.3;
    this._maxZoom = 3.0;
    this._mapWidthTiles = null;
    this._mapHeightTiles = null;
  }

  resize(w, h) {
    this.width  = w;
    this.height = h;
    this._enforceMinZoom();
  }

  setMapBounds(mapWidthTiles, mapHeightTiles) {
    this._mapWidthTiles = mapWidthTiles;
    this._mapHeightTiles = mapHeightTiles;
    this._enforceMinZoom();
  }

  // -------------------------------------------------------
  // Clamp within map bounds (call after any pan/zoom)
  // -------------------------------------------------------
  clamp(mapWidthTiles, mapHeightTiles) {
    this.setMapBounds(mapWidthTiles, mapHeightTiles);
    const wPx = mapWidthTiles  * TILE_SIZE * this.zoom;
    const hPx = mapHeightTiles * TILE_SIZE * this.zoom;
    const maxX = Math.max(0, wPx - this.width);
    const maxY = Math.max(0, hPx - this.height);
    this.x = Math.max(0, Math.min(this.x, maxX));
    this.y = Math.max(0, Math.min(this.y, maxY));
  }

  // -------------------------------------------------------
  // Pan
  // -------------------------------------------------------
  pan(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  panTo(worldX, worldY) {
    this.x = worldX * TILE_SIZE * this.zoom - this.width  / 2;
    this.y = worldY * TILE_SIZE * this.zoom - this.height / 2;
  }

  centerOn(worldPxX, worldPxY) {
    this.x = worldPxX * this.zoom - this.width / 2;
    this.y = worldPxY * this.zoom - this.height / 2;
  }

  // -------------------------------------------------------
  // Zoom (pivot around screen point sx, sy)
  // -------------------------------------------------------
  zoomAt(delta, sx, sy) {
    const newZoom = Math.max(this.minZoom, Math.min(this._maxZoom, this.zoom * (1 + delta)));
    const worldX = (sx + this.x) / this.zoom;
    const worldY = (sy + this.y) / this.zoom;
    this.zoom = newZoom;
    this.x = worldX * this.zoom - sx;
    this.y = worldY * this.zoom - sy;
  }

  get minZoom() {
    if (!this._mapWidthTiles || !this._mapHeightTiles) return this._minZoom;

    const mapPixelWidth = this._mapWidthTiles * TILE_SIZE;
    const mapPixelHeight = this._mapHeightTiles * TILE_SIZE;
    const fitZoom = Math.max(this.width / mapPixelWidth, this.height / mapPixelHeight);

    return Math.min(this._maxZoom, Math.max(this._minZoom, fitZoom));
  }

  _enforceMinZoom() {
    const minZoom = this.minZoom;
    if (this.zoom < minZoom) this.zoom = minZoom;
  }

  // -------------------------------------------------------
  // Coordinate conversions
  // -------------------------------------------------------

  /** Screen (px) → world tile coords */
  screenToTile(sx, sy) {
    return {
      x: Math.floor((sx + this.x) / (TILE_SIZE * this.zoom)),
      y: Math.floor((sy + this.y) / (TILE_SIZE * this.zoom)),
    };
  }

  /** World tile coords → screen (px) top-left */
  tileToScreen(tx, ty) {
    return {
      x: tx * TILE_SIZE * this.zoom - this.x,
      y: ty * TILE_SIZE * this.zoom - this.y,
    };
  }

  /** World pixel → screen pixel */
  worldToScreen(wx, wy) {
    return {
      x: wx * this.zoom - this.x,
      y: wy * this.zoom - this.y,
    };
  }

  /** Screen pixel → world pixel */
  screenToWorld(sx, sy) {
    return {
      x: (sx + this.x) / this.zoom,
      y: (sy + this.y) / this.zoom,
    };
  }

  // -------------------------------------------------------
  // Visibility
  // -------------------------------------------------------

  /** Returns {minX, maxX, minY, maxY} in tile coords visible on screen */
  visibleTileRect(mapW, mapH) {
    const ts = TILE_SIZE * this.zoom;
    return {
      minX: Math.max(0,    Math.floor(this.x / ts) - 1),
      minY: Math.max(0,    Math.floor(this.y / ts) - 1),
      maxX: Math.min(mapW, Math.ceil((this.x + this.width)  / ts) + 1),
      maxY: Math.min(mapH, Math.ceil((this.y + this.height) / ts) + 1),
    };
  }

  isTileVisible(tx, ty) {
    const { x, y } = this.tileToScreen(tx, ty);
    const ts = TILE_SIZE * this.zoom;
    return x + ts > 0 && x < this.width && y + ts > 0 && y < this.height;
  }

  serialize() { return { x: this.x, y: this.y, zoom: this.zoom }; }
  deserialize(d) { this.x = d.x; this.y = d.y; this.zoom = Math.max(this.minZoom, d.zoom); }
}
