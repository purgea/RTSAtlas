/**
 * A* pathfinder using a binary min-heap priority queue.
 * Works on the GameMap tile grid.
 */

class MinHeap {
  constructor() { this.data = []; }

  push(node) {
    this.data.push(node);
    this._bubbleUp(this.data.length - 1);
  }

  pop() {
    if (this.data.length === 0) return null;
    const top  = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() { return this.data.length; }

  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].f <= this.data[i].f) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }

  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let s = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.data[l].f < this.data[s].f) s = l;
      if (r < n && this.data[r].f < this.data[s].f) s = r;
      if (s === i) break;
      [this.data[s], this.data[i]] = [this.data[i], this.data[s]];
      i = s;
    }
  }
}

export class AStar {
  /**
   * @param {GameMap} map  Must expose: width, height, isPassable(x,y), getCost(x,y)
   */
  constructor(map) {
    this.map = map;
  }

  /**
   * Find a path from (sx,sy) to (ex,ey).
   * Returns array of {x,y} tile steps (excluding start), or null if unreachable.
   * @param {number} maxNodes – abort after this many expansions (performance guard)
   */
  find(sx, sy, ex, ey, maxNodes = 3000) {
    const { map } = this;
    if (sx === ex && sy === ey) return [];
    if (!map.isPassable(ex, ey)) return null;

    const w = map.width;
    const key = (x, y) => y * w + x;
    const heuristic = (x, y) => Math.abs(x - ex) + Math.abs(y - ey);

    const open    = new MinHeap();
    const gScore  = new Float32Array(map.width * map.height).fill(Infinity);
    const cameFrom = new Int32Array(map.width * map.height).fill(-1);
    const closed  = new Uint8Array(map.width * map.height);

    const sk = key(sx, sy);
    gScore[sk] = 0;
    open.push({ x: sx, y: sy, f: heuristic(sx, sy) });

    let expanded = 0;
    const DX = [-1, 1, 0, 0, -1, 1, -1, 1];
    const DY = [ 0, 0,-1, 1, -1,-1,  1, 1];
    const DC = [1.0, 1.0, 1.0, 1.0, 1.414, 1.414, 1.414, 1.414];

    while (open.size > 0 && expanded < maxNodes) {
      const cur = open.pop();
      const ck  = key(cur.x, cur.y);

      if (closed[ck]) continue;
      closed[ck] = 1;
      expanded++;

      if (cur.x === ex && cur.y === ey) {
        // Reconstruct path
        const path = [];
        let k = ck;
        while (cameFrom[k] !== -1) {
          path.unshift({ x: k % w, y: Math.floor(k / w) });
          k = cameFrom[k];
        }
        return path;
      }

      for (let d = 0; d < 8; d++) {
        const nx = cur.x + DX[d];
        const ny = cur.y + DY[d];
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        if (!map.isPassable(nx, ny)) continue;

        const nk = key(nx, ny);
        if (closed[nk]) continue;

        // Block diagonal moves that clip corners
        if (d >= 4) {
          if (!map.isPassable(cur.x + DX[d], cur.y) ||
              !map.isPassable(cur.x, cur.y + DY[d])) continue;
        }

        const g = gScore[ck] + DC[d] * (map.getCost ? map.getCost(nx, ny) : 1);
        if (g < gScore[nk]) {
          gScore[nk]  = g;
          cameFrom[nk] = ck;
          open.push({ x: nx, y: ny, f: g + heuristic(nx, ny) });
        }
      }
    }

    return null; // no path found
  }

  /** Simple tile-grid reachability check (BFS flood-fill) */
  isReachable(sx, sy, ex, ey) {
    const { map } = this;
    if (!map.isPassable(ex, ey)) return false;
    const w   = map.width;
    const key = (x, y) => y * w + x;
    const visited = new Uint8Array(w * map.height);
    const queue = [{ x: sx, y: sy }];
    visited[key(sx, sy)] = 1;

    while (queue.length > 0) {
      const { x, y } = queue.shift();
      if (x === ex && y === ey) return true;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        const nk = key(nx, ny);
        if (!visited[nk] && map.isPassable(nx, ny)) {
          visited[nk] = 1;
          queue.push({ x: nx, y: ny });
        }
      }
    }
    return false;
  }
}
