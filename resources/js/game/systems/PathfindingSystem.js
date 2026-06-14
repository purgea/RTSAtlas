import { COMP, TILE_SIZE } from '../constants.js';
import { AStar } from '../utils/AStar.js';

/**
 * PathfindingSystem — C&C-responsive pathfinding.
 *
 * Player-commanded moves are computed SYNCHRONOUSLY on the same tick they
 * are issued (maps ≤ 192×192 complete in < 2ms per path).
 * AI moves use the deferred queue with a generous budget of 32/tick.
 */
export class PathfindingSystem {
  constructor(ecs, map) {
    this.ecs   = ecs;
    this.map   = map;
    this.astar = new AStar(map);
    this._queue    = [];  // deferred AI requests
    this._perTick  = 32; // AI paths per tick
  }

  update(dt, tick) {
    const { ecs } = this;

    // Collect deferred requests (AI / non-urgent)
    for (const id of ecs.query(COMP.MOVEMENT, COMP.POSITION)) {
      const mov = ecs.getComponent(id, COMP.MOVEMENT);
      if (!mov.pendingTarget) continue;
      if (mov.urgentPath) {
        // Synchronous — compute now
        this._computePath(id, mov);
        mov.urgentPath = false;
      } else {
        this._queue.push(id);
      }
    }

    // Process deferred queue
    const count = Math.min(this._perTick, this._queue.length);
    for (let i = 0; i < count; i++) {
      const id = this._queue.shift();
      if (!ecs.exists(id)) continue;
      const mov = ecs.getComponent(id, COMP.MOVEMENT);
      if (mov?.pendingTarget) this._computePath(id, mov);
    }
  }

  /**
   * Issue an IMMEDIATE path for player-commanded movement.
   * Path is computed synchronously before the next render frame.
   */
  requestImmediate(entityId, targetX, targetY) {
    const mov = this.ecs.getComponent(entityId, COMP.MOVEMENT);
    if (!mov) return;
    mov.pendingTarget = { x: targetX, y: targetY };
    mov.urgentPath    = true;
    mov.path          = [];
    mov.pathIndex     = 0;
    // Compute right now
    this._computePath(entityId, mov);
    mov.urgentPath = false;
  }

  /** Queue a non-urgent path (AI, harvester) */
  requestDeferred(entityId, targetX, targetY) {
    const mov = this.ecs.getComponent(entityId, COMP.MOVEMENT);
    if (!mov) return;
    mov.pendingTarget   = { x: targetX, y: targetY };
    mov.path            = [];
    mov.pathIndex       = 0;
    this._queue.push(entityId);
  }

  _computePath(id, mov) {
    const pos = this.ecs.getComponent(id, COMP.POSITION);
    if (!pos || !mov.pendingTarget) return;

    const sx = Math.floor(pos.x / TILE_SIZE);
    const sy = Math.floor(pos.y / TILE_SIZE);
    const ex = mov.pendingTarget.x;
    const ey = mov.pendingTarget.y;

    const path = this.astar.find(sx, sy, ex, ey, 4000) || [];
    mov.path          = path;
    mov.pathIndex     = 0;
    mov.pendingTarget = null;
    if (path.length > 0) mov.state = 'moving';
  }
}
