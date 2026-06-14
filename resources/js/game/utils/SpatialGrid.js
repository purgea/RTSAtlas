/**
 * Uniform spatial grid for O(1) amortized nearest-neighbour queries.
 * Stores arbitrary entity IDs (numbers) keyed by (x, y) world position.
 */
export class SpatialGrid {
  /**
   * @param {number} worldWidth  – total world width in pixels
   * @param {number} worldHeight – total world height in pixels
   * @param {number} cellSize    – grid cell size in pixels (should be >= query radius)
   */
  constructor(worldWidth, worldHeight, cellSize = 128) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldWidth  / cellSize);
    this.rows = Math.ceil(worldHeight / cellSize);
    this.cells = new Array(this.cols * this.rows).fill(null).map(() => new Set());
    // Track entity -> cell index so we can move/remove efficiently
    this._entityCell = new Map();
  }

  _idx(x, y) {
    const col = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cellSize)));
    const row = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cellSize)));
    return row * this.cols + col;
  }

  insert(entityId, x, y) {
    const idx = this._idx(x, y);
    this.cells[idx].add(entityId);
    this._entityCell.set(entityId, idx);
  }

  remove(entityId) {
    const idx = this._entityCell.get(entityId);
    if (idx !== undefined) {
      this.cells[idx].delete(entityId);
      this._entityCell.delete(entityId);
    }
  }

  move(entityId, newX, newY) {
    const newIdx = this._idx(newX, newY);
    const oldIdx = this._entityCell.get(entityId);
    if (oldIdx !== newIdx) {
      if (oldIdx !== undefined) this.cells[oldIdx].delete(entityId);
      this.cells[newIdx].add(entityId);
      this._entityCell.set(entityId, newIdx);
    }
  }

  /**
   * Returns a Set of entity IDs within `radius` pixels of (x, y).
   * Not distance-filtered — callers should check exact distance if needed.
   */
  queryRadius(x, y, radius) {
    const minCol = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
    const minRow = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));

    const result = new Set();
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        for (const id of this.cells[row * this.cols + col]) {
          result.add(id);
        }
      }
    }
    return result;
  }

  /** Returns entity IDs in the rectangle defined by (x1,y1)-(x2,y2) */
  queryRect(x1, y1, x2, y2) {
    const minCol = Math.max(0, Math.floor(x1 / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.floor(x2 / this.cellSize));
    const minRow = Math.max(0, Math.floor(y1 / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.floor(y2 / this.cellSize));

    const result = new Set();
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        for (const id of this.cells[row * this.cols + col]) {
          result.add(id);
        }
      }
    }
    return result;
  }

  clear() {
    for (const cell of this.cells) cell.clear();
    this._entityCell.clear();
  }

  get entityCount() {
    return this._entityCell.size;
  }
}
