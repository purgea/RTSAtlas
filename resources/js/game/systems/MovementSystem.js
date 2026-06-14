import { COMP, TILE_SIZE } from '../constants.js';

/**
 * MovementSystem — C&C-responsive unit movement.
 *
 * Units follow A* tile paths at their configured speed (tiles/sec).
 * Facing angle is stored on the MOVEMENT component for sprite orientation.
 * Fog is revealed continuously for all player-faction entities.
 */
export class MovementSystem {
  constructor(ecs, map, spatial) {
    this.ecs     = ecs;
    this.map     = map;
    this.spatial = spatial;
  }

  update(dt) {
    const { ecs, map, spatial } = this;

    map.resetFogVisible?.();

    for (const id of ecs.query(COMP.MOVEMENT, COMP.POSITION)) {
      const pos = ecs.getComponent(id, COMP.POSITION);
      const mov = ecs.getComponent(id, COMP.MOVEMENT);

      if (mov.state === 'moving' && mov.path && mov.path.length > 0) {
        const speed  = (mov.speed ?? 3) * TILE_SIZE; // tiles/sec → px/sec
        let   toMove = speed * dt;
        const oldX   = pos.x, oldY = pos.y;

        while (toMove > 0 && mov.pathIndex < mov.path.length) {
          const node = mov.path[mov.pathIndex];
          const tx   = (node.x + 0.5) * TILE_SIZE;
          const ty   = (node.y + 0.5) * TILE_SIZE;
          const dx   = tx - pos.x;
          const dy   = ty - pos.y;
          const dist = Math.sqrt(dx*dx + dy*dy);

          if (dist <= toMove) {
            pos.x = tx; pos.y = ty;
            toMove -= dist;
            if (dist > 0.1) mov.facing = Math.atan2(dy, dx);
            mov.pathIndex++;
          } else {
            const ratio = toMove / dist;
            pos.x += dx * ratio;
            pos.y += dy * ratio;
            mov.facing = Math.atan2(dy, dx);
            toMove = 0;
          }
        }

        spatial.move(id, oldX, oldY, pos.x, pos.y);

        if (mov.pathIndex >= mov.path.length) {
          mov.state     = 'idle';
          mov.path      = [];
          mov.pathIndex = 0;
        }
      }

      // Reveal fog for player-faction entities
      const faction = ecs.getComponent(id, COMP.FACTION);
      if (faction?.isPlayer) {
        const sight = ecs.getComponent(id, COMP.UNIT)?.sight
                   ?? ecs.getComponent(id, COMP.BUILDING)?.sight
                   ?? 5;
        map.reveal?.(
          Math.floor(pos.x / TILE_SIZE),
          Math.floor(pos.y / TILE_SIZE),
          sight,
        );
      }
    }
  }
}
