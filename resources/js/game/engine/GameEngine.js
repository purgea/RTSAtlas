import { ECS }          from './ECS.js';
import { GameLoop }     from './GameLoop.js';
import { Camera }       from './Camera.js';
import { GameMap }      from '../systems/GameMap.js';
import { RenderSystem }      from '../systems/RenderSystem.js';
import { MovementSystem }    from '../systems/MovementSystem.js';
import { PathfindingSystem } from '../systems/PathfindingSystem.js';
import { CombatSystem }      from '../systems/CombatSystem.js';
import { ProductionSystem }  from '../systems/ProductionSystem.js';
import { PowerSystem }       from '../systems/PowerSystem.js';
import { HarvesterAI }       from '../systems/HarvesterAI.js';
import { ProjectileSystem }  from '../systems/ProjectileSystem.js';
import { ParticleSystem }    from '../systems/ParticleSystem.js';
import { AISystem }          from '../systems/AISystem.js';
import { EventSystem }       from '../systems/EventSystem.js';
import { ProceduralGenerator } from '../generation/ProceduralGenerator.js';
import { SpatialGrid }       from '../utils/SpatialGrid.js';
import { spriteCache }       from '../sprites/SpriteCache.js';
import {
  COMP, TILE_SIZE,
  CREDITS_KEY, HARVESTER_CARRY, ORE_REGEN_RATE,
  categoryToRole, UNIT_ROLE,
} from '../constants.js';

/**
 * GameEngine — C&C-style RTS engine for RTSAtlas.
 *
 * All gameplay config (units, buildings, factions, resources) is read from
 * projectConfig, which is fetched from the editor's database on game load.
 *
 * Key design decisions:
 *  - factionResources[fId].gold   = credits (main currency)
 *  - building.provides.power      = power contribution (+supply / -drain)
 *  - building.trains[]            = unit keys this building can produce
 *  - Ore fields from map.features where type === 'mine'
 *  - Harvesters: units where categoryToRole(cat) === UNIT_ROLE.HARVESTER
 *  - Con Yard: building key containing 'castle'|'con_yard'|'hq'|'headquarters'
 *  - All AI factions are enemies of the player
 *
 * Input (C&C style):
 *  L-click            → select entity / deselect
 *  L-drag             → box select own units
 *  R-click ground     → move selected units
 *  R-click enemy      → attack-move to target
 *  R-click own bldg   → set rally point
 *  Ctrl+1..9          → assign control group
 *  1..9               → recall control group
 *  Space              → center camera on Con Yard
 *  Escape             → deselect / cancel build mode
 *  Delete             → sell selected building (50% refund)
 *  Arrow keys         → scroll camera
 *  Middle drag        → pan camera
 *  Wheel              → zoom
 */
export class GameEngine {
  constructor(canvas, projectConfig) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.config  = projectConfig;

    this.ecs     = new ECS();
    this.map     = null;
    this.camera  = new Camera(canvas.width, canvas.height);
    this.spatial = null;

    this.loop = new GameLoop(
      (dt)    => this._tick(dt),
      (alpha, dt) => this._render(alpha, dt),
    );

    // Game state
    this.tick             = 0;
    this.playerFactionId  = null;
    this.factionResources = {};   // { [fId]: { gold, ... } }
    this.factionPower     = {};   // { [fId]: { supply, drain, deficit } }
    this.factionEnemies   = new Map(); // fId → Set<fId>

    // Selection & input
    this.selectedEntities = new Set();
    this.hoverTile        = null;
    this.buildMode        = null;    // { key, category, size, valid, factionColor }
    this._dragStart       = null;
    this._selectionRect   = null;
    this._keys            = new Set();
    this._mouse           = { x: 0, y: 0, buttons: 0 };
    this._screenMouse     = { x: 0, y: 0, active: false };
    this._controlGroups   = {}; // 1..9 → Set<entityId>
    this._moveMarkers     = [];

    // Systems (set up in _initSystems after map is ready)
    this.systems       = [];
    this.pathfinding   = null;
    this.combat        = null;
    this.production    = null;
    this.power         = null;
    this.harvesterAI   = null;
    this.projectiles   = null;
    this.particles     = null;
    this.aiSystem      = null;
    this.eventSystem   = null;
    this.render        = null;
    this.activeEvents  = [];
  }

  // -------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------

  newGame(seed, settings = {}) {
    const mapW = settings.map_width  || 96;
    const mapH = settings.map_height || 96;

    const gen  = new ProceduralGenerator(seed, mapW, mapH, settings.procedural || {});
    this.map   = gen.generate();

    this.spatial = new SpatialGrid(mapW * TILE_SIZE, mapH * TILE_SIZE, TILE_SIZE * 4);

    // Pregenerate sprites once
    spriteCache.pregenerate(
      this.config.unitConfigs     || [],
      this.config.buildingConfigs || [],
      this.config.factions        || [],
    );

    this._initSystems();
    this._spawnFactions(settings);
    this._spawnOreFields();
    this._setupEnemyMap();
    this._initInput();
    this._registerECSEvents();

    this.tick = 0;
  }

  loadGame(snapshot) {
    this.tick = snapshot.tick || 0;
    this.map  = GameMap.fromSnapshot(snapshot.mapData);

    const mapW = this.map.width;
    const mapH = this.map.height;
    this.spatial = new SpatialGrid(mapW * TILE_SIZE, mapH * TILE_SIZE, TILE_SIZE * 4);

    spriteCache.pregenerate(
      this.config.unitConfigs     || [],
      this.config.buildingConfigs || [],
      this.config.factions        || [],
    );

    this._initSystems();
    this.ecs.deserialize(snapshot.ecsState);
    this._rebuildSpatialGrid();

    if (snapshot.camera) this.camera.deserialize(snapshot.camera);
    this.factionResources = snapshot.factionResources || {};
    this.playerFactionId  = snapshot.playerFactionId  || null;

    this._setupEnemyMap();
    this._initInput();
    this._registerECSEvents();
  }

  saveGame() {
    return {
      tick:             this.tick,
      mapData:          this.map.serialize(),
      ecsState:         this.ecs.serialize(),
      camera:           this.camera.serialize(),
      factionResources: this.factionResources,
      playerFactionId:  this.playerFactionId,
    };
  }

  start()      { this.loop.start(); }
  stop()       { this.loop.stop();  }
  pause()      { this.loop.pause(); }
  resume()     { this.loop.resume();}

  // -------------------------------------------------------
  // Systems init
  // -------------------------------------------------------

  _initSystems() {
    this.projectiles = new ProjectileSystem(this.ecs);
    this.particles   = new ParticleSystem();
    this.pathfinding = new PathfindingSystem(this.ecs, this.map);
    this.combat      = new CombatSystem(this.ecs, this.spatial, this.projectiles, this.particles, this.factionEnemies, this.map, this.pathfinding);
    this.power       = new PowerSystem(this.ecs, this.factionPower, this.config);
    this.production  = new ProductionSystem(this.ecs, this.factionResources, this.factionPower, this.config);
    this.harvesterAI = new HarvesterAI(this.ecs, this.spatial, this.factionResources, this.config);
    this.aiSystem    = new AISystem(
      this.ecs, this.map, this.spatial,
      this.factionResources, this.config,
      this.production, this.pathfinding, this.factionEnemies,
    );
    this.eventSystem = new EventSystem(this.ecs, this.map, this.factionResources, this.config, this.activeEvents);
    this.render = new RenderSystem(
      this.ctx, this.map, this.camera, this.ecs,
      this.projectiles, this.particles,
    );
    this.systems = [
      this.pathfinding,
      { update: (dt) => new MovementSystem(this.ecs, this.map, this.spatial).update.call(
          new MovementSystem(this.ecs, this.map, this.spatial), dt) },  // placeholder – see below
    ];
    // Build real system list
    this._movement = new MovementSystem(this.ecs, this.map, this.spatial);
    this.systems = [
      this.pathfinding,
      this._movement,
      this.combat,
      this.power,
      this.production,
      this.harvesterAI,
      this.aiSystem,
      this.eventSystem,
    ];
  }

  // -------------------------------------------------------
  // Faction and unit spawn
  // -------------------------------------------------------

  _spawnFactions(settings) {
    const startingResources = settings.starting_resources || {};
    const defaultStart = { [CREDITS_KEY]: 3000 };
    const startRes = Object.keys(startingResources).length > 0 ? startingResources : defaultStart;

    const factions = this.config.factions || [];
    const spawns   = this.map.getStartPositions(factions.length);

    factions.forEach((fdef, i) => {
      const fId     = i + 1; // simple numeric IDs starting at 1
      const isPlayer = (i === 0); // first faction = player

      if (isPlayer) this.playerFactionId = fId;
      this.factionResources[fId] = { ...defaultStart, ...startRes };
      this.factionPower[fId]     = { supply: 0, drain: 0, deficit: false };

      // Store faction meta as a plain object (not ECS entity) for simplicity
      if (!this._factionMeta) this._factionMeta = {};
      this._factionMeta[fId] = {
        id:       fId,
        name:     fdef.name,
        color:    fdef.color || (i === 0 ? '#4169e1' : '#cc2222'),
        emblem:   fdef.emblem || '',
        isPlayer,
        aiProfile: fdef.ai_profile || { aggression: 0.5, expansion: 0.5, economy: 0.5 },
      };

      // Build FACTION component on a dedicated entity so ECS queries work
      const fEntity = this.ecs.createEntity(`faction:${fdef.name}`);
      this.ecs.addComponent(fEntity, COMP.FACTION, {
        id:       fId,
        name:     fdef.name,
        color:    fdef.color || (i === 0 ? '#4169e1' : '#cc2222'),
        emblem:   fdef.emblem || '',
        isPlayer,
        aiProfile: fdef.ai_profile || {},
      });

      // Spawn Con Yard (first building whose key matches con_yard / castle / hq)
      const conYardDef = (this.config.buildingConfigs || []).find(b => {
        const k = (b.key || '').toLowerCase();
        return k.includes('castle') || k.includes('con_yard') || k.includes('hq') || k.includes('headquarters');
      }) || (this.config.buildingConfigs || [])[0];
      const rawSpawn = spawns[i] || { x: 10 + i * 40, y: 10 };
      const sp = this._findNearestClearArea(rawSpawn.x, rawSpawn.y, conYardDef?.size || 3, 16) || rawSpawn;

      if (conYardDef) {
        const baseId = this._spawnBuilding(conYardDef.key, fId, sp.x, sp.y, conYardDef);
        const base = this.ecs.getComponent(baseId, COMP.BUILDING);
        if (base) base.isBaseCore = true;
      }

      // Spawn power plant
      const powerDef = (this.config.buildingConfigs || []).find(b => (b.key || '').toLowerCase().includes('power'));
      if (powerDef) {
        const sz = powerDef.size || 2;
        const pos = this._findNearestClearArea(sp.x + (conYardDef?.size || 3) + 1, sp.y, sz, 8);
        if (pos) this._spawnBuilding(powerDef.key, fId, pos.x, pos.y, powerDef);
      }

      // Spawn refinery if available
      const refineryDef = (this.config.buildingConfigs || []).find(b => (b.key || '').toLowerCase().includes('refinery'));
      if (refineryDef) {
        const sz = refineryDef.size || 2;
        const pos = this._findNearestClearArea(sp.x, sp.y + (conYardDef?.size || 3) + 1, sz, 8);
        if (pos) this._spawnBuilding(refineryDef.key, fId, pos.x, pos.y, refineryDef);
      }

      // Spawn starting military units
      const militaryUnitDef = (this.config.unitConfigs || []).find(u => {
        const role = categoryToRole(u.category);
        return role === UNIT_ROLE.INFANTRY || role === UNIT_ROLE.VEHICLE;
      });
      if (militaryUnitDef) {
        for (let j = 0; j < 4; j++) {
          this._spawnUnit(militaryUnitDef.key, fId, sp.x + 3 + j, sp.y + (conYardDef?.size || 3) + 2, militaryUnitDef);
        }
      }

      // Spawn starting harvester if refinery exists
      const harvesterDef = (this.config.unitConfigs || []).find(u => categoryToRole(u.category) === UNIT_ROLE.HARVESTER);
      if (harvesterDef && refineryDef) {
        this._spawnUnit(harvesterDef.key, fId, sp.x + 1, sp.y + (conYardDef?.size || 3) + 4, harvesterDef);
      }
    });
  }

  _spawnOreFields() {
    // Create ORE_FIELD entities from map features of type 'mine'
    for (const feat of (this.map.features || [])) {
      if (feat.type !== 'mine') continue;
      const amount = feat.data?.amount ?? 1500;
      const id = this.ecs.createEntity(`ore_field:${feat.x}_${feat.y}`);
      const wx = (feat.x + 0.5) * TILE_SIZE;
      const wy = (feat.y + 0.5) * TILE_SIZE;
      this.ecs.addComponent(id, COMP.POSITION,  { x: wx, y: wy });
      this.ecs.addComponent(id, COMP.ORE_FIELD, {
        amount,
        maxAmount: amount,
        regenRate: ORE_REGEN_RATE,
      });
      this.spatial.insert(id, wx, wy);
    }
  }

  _setupEnemyMap() {
    // In C&C mode: player faction is enemy of all AI factions and vice versa
    this.factionEnemies.clear();
    const fIds = Object.keys(this._factionMeta || {}).map(Number);
    for (const fId of fIds) {
      this.factionEnemies.set(fId, new Set(fIds.filter(o => o !== fId)));
    }
    // Update combat system reference
    if (this.combat) this.combat.enemies = this.factionEnemies;
    if (this.aiSystem) this.aiSystem.enemies = this.factionEnemies;
  }

  _spawnUnit(key, fId, tx, ty, def) {
    def = def || (this.config.unitConfigs || []).find(u => u.key === key) || {};
    const id = this.ecs.createEntity(`unit:${key}`);
    const spawnTile = this._findNearestPassableTile(tx, ty, 8) || { x: tx, y: ty };
    tx = spawnTile.x;
    ty = spawnTile.y;
    const wx = (tx + 0.5) * TILE_SIZE;
    const wy = (ty + 0.5) * TILE_SIZE;
    const role = categoryToRole(def.category || '');
    const meta = (this._factionMeta || {})[fId] || {};

    this.ecs.addComponent(id, COMP.POSITION,   { x: wx, y: wy });
    this.ecs.addComponent(id, COMP.UNIT, {
      key,
      name:      def.name     || key,
      sprite:    def.sprite   || '',
      category:  def.category || 'infantry',
      sight:     def.sight    || 6,
      speed:     def.speed    || 3,
    });
    this.ecs.addComponent(id, COMP.FACTION, {
      id:       fId,
      color:    meta.color    || '#888888',
      isPlayer: meta.isPlayer || false,
    });
    this.ecs.addComponent(id, COMP.HEALTH, {
      hp:    def.health || 100,
      maxHp: def.health || 100,
    });
    this.ecs.addComponent(id, COMP.COMBAT, {
      damage:        def.damage        || 10,
      armor:         def.armor         || 0,
      range:         def.ranged_attack ? (def.range || 5) : 1,
      ranged:        !!def.ranged_attack,
      attackRate:    Math.max(0.1, def.attackRate ?? def.attack_rate ?? 1.0),
      attackCooldown: 0,
      targetId:      null,
      projectileType: role === UNIT_ROLE.VEHICLE ? 'shell' : 'bullet',
      aoeRadius:     role === UNIT_ROLE.VEHICLE ? 0.8 : 0,
    });
    this.ecs.addComponent(id, COMP.MOVEMENT, {
      speed:     def.speed    || 3,
      path:      [],
      pathIndex: 0,
      state:     'idle',
      facing:    0,
    });

    if (role === UNIT_ROLE.HARVESTER) {
      this.ecs.addComponent(id, COMP.HARVESTER, {
        state:        'idle',
        carryAmount:  0,
        maxCarry:     HARVESTER_CARRY,
        oreFieldId:   null,
        targetPos:    null,
        depositPos:   null,
        harvestTimer: 0,
      });
    }

    this.ecs.addComponent(id, COMP.ORDER, { type: null });
    this.spatial.insert(id, wx, wy);
    return id;
  }

  _findNearestPassableTile(cx, cy, radius) {
    for (let r = 0; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (this.map.isPassable(x, y)) return { x, y };
        }
      }
    }
    return null;
  }

  _findNearestClearArea(cx, cy, size, radius) {
    for (let r = 0; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (this._isClearArea(x, y, size)) return { x, y };
        }
      }
    }
    return null;
  }

  _isClearArea(tx, ty, size) {
    if (tx < 1 || ty < 1 || tx + size >= this.map.width - 1 || ty + size >= this.map.height - 1) {
      return false;
    }

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        if (!this.map.isPassable(tx + dx, ty + dy)) return false;
      }
    }

    return true;
  }

  _spawnBuilding(key, fId, tx, ty, def) {
    def = def || (this.config.buildingConfigs || []).find(b => b.key === key) || {};
    const id   = this.ecs.createEntity(`building:${key}`);
    const size = def.size || 2;
    const wx   = (tx + size / 2) * TILE_SIZE;
    const wy   = (ty + size / 2) * TILE_SIZE;
    const meta = (this._factionMeta || {})[fId] || {};

    this.ecs.addComponent(id, COMP.POSITION,  { x: wx, y: wy });
    this.ecs.addComponent(id, COMP.BUILDING,  {
      key,
      name:          def.name   || key,
      sprite:        def.sprite || '',
      category:      def.category     || 'military',
      armor:         def.armor        || 0,
      size,
      tileX:         tx,
      tileY:         ty,
      buildProgress: 1.0,
      sight:         def.sight        || 5,
    });
    this.ecs.addComponent(id, COMP.FACTION, {
      id:       fId,
      color:    meta.color    || '#888888',
      isPlayer: meta.isPlayer || false,
    });
    this.ecs.addComponent(id, COMP.HEALTH,  {
      hp:    def.health || 500,
      maxHp: def.health || 500,
    });

    // Production queue for buildings that can train units
    const trains = Array.isArray(def.trains) ? def.trains : [];
    this.ecs.addComponent(id, COMP.PRODUCTION, {
      queue:      [],
      progress:   0,
      rallyPoint: null,
      powerDrain: def.provides?.power < 0 ? Math.abs(def.provides.power) : 0,
    });

    if (def.provides) {
      this.ecs.addComponent(id, COMP.POWER, { provides: def.provides });
    }

    // Mark tiles occupied
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        this.map.setBuilding?.(tx + dx, ty + dy, id);
      }
    }

    this.spatial.insert(id, wx, wy);
    return id;
  }

  // -------------------------------------------------------
  // ECS event listeners (construction complete, unit produced, etc.)
  // -------------------------------------------------------

  _registerECSEvents() {
    const { ecs } = this;

    // AI builds a building
    ecs.on('aiBuild', ({ factionId, key, x, y }) => {
      const def = (this.config.buildingConfigs || []).find(b => b.key === key);
      if (!def) return;
      const id = this._spawnBuilding(key, factionId, x, y, def);
      // Start with 0% build progress for AI (optional visual)
    });

    // Unit produced by ProductionSystem
    ecs.on('unitProduced', ({ buildingId, unitKey, factionId, rallyPoint }) => {
      const def = (this.config.unitConfigs || []).find(u => u.key === unitKey);
      if (!def) return;
      const bld   = ecs.getComponent(buildingId, COMP.BUILDING);
      const bPos  = ecs.getComponent(buildingId, COMP.POSITION);
      const size  = bld?.size ?? 2;
      // Spawn adjacent to building
      const tx = (bld?.tileX ?? 0) + size + 1;
      const ty = bld?.tileY ?? 0;
      const id = this._spawnUnit(unitKey, factionId, tx, ty, def);
      // Move to rally point
      if (rallyPoint) {
        this.pathfinding.requestImmediate(id, rallyPoint.x, rallyPoint.y);
      }
    });

    // Entity destroyed (combat death)
    ecs.on('entityDestroyed', (id) => {
      // Remove from selections
      this.selectedEntities.delete(id);
      // Remove from spatial
      const pos = ecs.getComponent(id, COMP.POSITION);
      if (pos) this.spatial.remove?.(id, pos.x, pos.y);
      // Check victory
      this._checkVictory();
    });
  }

  // -------------------------------------------------------
  // Core loop
  // -------------------------------------------------------

  _tick(dt) {
    this.tick++;
    this._updateMoveMarkers(dt);

    // Update projectiles and particles (cosmetic — not in systems[] for ordering control)
    this.projectiles.update(dt);
    this.particles.update(dt);

    for (const sys of this.systems) {
      sys.update(dt, this.tick);
    }
  }

  _render(alpha, dt) {
    this._updateEdgeScroll(dt ?? (1 / 60));

    this.render.render(
      alpha, dt ?? (1 / 60),
      this.selectedEntities,
      this._selectionRect,
      this.hoverTile,
      this.buildMode,
      this._moveMarkers,
    );
  }

  // -------------------------------------------------------
  // Input
  // -------------------------------------------------------

  _initInput() {
    const canvas = this.canvas;

    canvas.addEventListener('mousedown',   e => this._onMouseDown(e));
    canvas.addEventListener('mousemove',   e => this._onMouseMove(e));
    canvas.addEventListener('mouseup',     e => this._onMouseUp(e));
    canvas.addEventListener('wheel',       e => this._onWheel(e), { passive: false });
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); this._onRightClick(e); });

    window.addEventListener('mousemove', e => {
      this._screenMouse = { x: e.clientX, y: e.clientY, active: true };
    });
    window.addEventListener('keydown', e => { this._keys.add(e.key); this._onKeyDown(e); });
    window.addEventListener('keyup',   e => this._keys.delete(e.key));
  }

  _xy(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _onMouseDown(e) {
    const { x, y } = this._xy(e);
    this._mouse = { x, y, buttons: e.buttons };
    if (e.button === 0) {
      this._dragStart     = { x, y };
      this._selectionRect = null;
    }
  }

  _onMouseMove(e) {
    const { x, y } = this._xy(e);
    const dx = x - this._mouse.x;
    const dy = y - this._mouse.y;
    this._mouse = { x, y, buttons: e.buttons };
    this.hoverTile = this.camera.screenToTile(x, y);

    // Middle mouse or right mouse drag → pan
    if (e.buttons & 4) {
      this.camera.pan(-dx, -dy);
      this.camera.clamp(this.map.width, this.map.height);
    }

    // Left drag → selection rect
    if ((e.buttons & 1) && this._dragStart) {
      const dxT = Math.abs(x - this._dragStart.x);
      const dyT = Math.abs(y - this._dragStart.y);
      if (dxT > 4 || dyT > 4) {
        this._selectionRect = {
          x1: Math.min(x, this._dragStart.x),
          y1: Math.min(y, this._dragStart.y),
          x2: Math.max(x, this._dragStart.x),
          y2: Math.max(y, this._dragStart.y),
        };
      }
    }

    // Update build mode validity
    if (this.buildMode && this.hoverTile) {
      this.buildMode.valid = this._canPlaceAt(this.hoverTile.x, this.hoverTile.y, this.buildMode.size ?? 2);
    }
  }

  _onMouseUp(e) {
    const { x, y } = this._xy(e);
    if (e.button === 0) {
      if (this._selectionRect) {
        this._applySelectionRect(this._selectionRect);
      } else {
        this._handleLeftClick(x, y);
      }
      this._selectionRect = null;
      this._dragStart     = null;
    }
    this._mouse.buttons = e.buttons;
  }

  _onWheel(e) {
    e.preventDefault();
    const { x, y } = this._xy(e);
    this.camera.zoomAt(e.deltaY < 0 ? 0.12 : -0.12, x, y);
    this.camera.clamp(this.map.width, this.map.height);
  }

  _onRightClick(e) {
    const { x, y } = this._xy(e);
    const wc   = this.camera.screenToWorld(x, y);
    const tile = this.camera.screenToTile(x, y);

    if (this.selectedEntities.size === 0) return;

    // Check for target entity at the clicked tile first. This makes attack
    // commands deterministic when the cursor is over a tile occupied by a unit.
    const target = this._enemyEntityOnTile(tile.x, tile.y) ?? this._entityAt(wc.x, wc.y);

    if (target) {
      const tFaction = this.ecs.getComponent(target, COMP.FACTION);
      if (tFaction && this.factionEnemies.get(this.playerFactionId)?.has(tFaction.id)) {
        this._addMoveMarker(tile.x, tile.y, 'attack');
        for (const id of this.selectedEntities) {
          if (!this.ecs.hasComponent(id, COMP.UNIT)) continue;
          this.combat.attackTarget(id, target);
        }
        return;
      }
      // Right-click own building with units selected → set rally point
      if (tFaction?.isPlayer && this.ecs.hasComponent(target, COMP.BUILDING)) {
        const prod = this.ecs.getComponent(target, COMP.PRODUCTION);
        if (prod) { prod.rallyPoint = { x: tile.x, y: tile.y }; return; }
      }
    }

    // Move command (C&C: units spread out around the target tile)
    this._addMoveMarker(tile.x, tile.y, 'move');
    const units = [...this.selectedEntities].filter(id => this.ecs.hasComponent(id, COMP.UNIT));
    const spread = Math.ceil(Math.sqrt(units.length));
    units.forEach((id, idx) => {
      const ox = (idx % spread) - Math.floor(spread / 2);
      const oy = Math.floor(idx / spread) - Math.floor(spread / 2);
      // Player commands always immediate (synchronous pathfind)
      this.pathfinding.requestImmediate(id, tile.x + ox, tile.y + oy);
      const combat = this.ecs.getComponent(id, COMP.COMBAT);
      const order = this.ecs.getComponent(id, COMP.ORDER);
      if (combat) combat.targetId = null;
      if (order) Object.assign(order, { type: 'move', targetId: null, targetTile: { x: tile.x + ox, y: tile.y + oy } });
    });
  }

  _addMoveMarker(tx, ty, type = 'move') {
    this._moveMarkers.push({
      x: (tx + 0.5) * TILE_SIZE,
      y: (ty + 0.5) * TILE_SIZE,
      type,
      age: 0,
      duration: 0.55,
    });
  }

  _updateMoveMarkers(dt) {
    for (const marker of this._moveMarkers) marker.age += dt;
    this._moveMarkers = this._moveMarkers.filter(marker => marker.age < marker.duration);
  }

  _updateEdgeScroll(dt) {
    if (!this.map || !this.camera) return;
    if (!this._screenMouse.active) return;

    const edge = 36;
    const speed = 720;
    let dx = 0;
    let dy = 0;

    const edgeStrength = (distance) => {
      const t = Math.max(0, Math.min(1, (edge - distance) / edge));
      return t * t * (3 - 2 * t);
    };

    if (this._screenMouse.x <= edge) {
      dx = -edgeStrength(this._screenMouse.x);
    } else if (this._screenMouse.x >= window.innerWidth - edge) {
      dx = edgeStrength(window.innerWidth - this._screenMouse.x);
    }

    if (this._screenMouse.y <= edge) {
      dy = -edgeStrength(this._screenMouse.y);
    } else if (this._screenMouse.y >= window.innerHeight - edge) {
      dy = edgeStrength(window.innerHeight - this._screenMouse.y);
    }

    if (dx !== 0 || dy !== 0) {
      const magnitude = Math.hypot(dx, dy);
      const scale = magnitude > 1 ? 1 / magnitude : 1;
      this.camera.pan(dx * scale * speed * dt, dy * scale * speed * dt);
      this.camera.clamp(this.map.width, this.map.height);
      this._refreshHoverTile();
    }
  }

  _refreshHoverTile() {
    const rect = this.canvas.getBoundingClientRect();
    const x = this._screenMouse.x - rect.left;
    const y = this._screenMouse.y - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    this.hoverTile = this.camera.screenToTile(x, y);
    if (this.buildMode && this.hoverTile) {
      this.buildMode.valid = this._canPlaceAt(this.hoverTile.x, this.hoverTile.y, this.buildMode.size ?? 2);
    }
  }

  _onKeyDown(e) {
    // Escape — deselect / cancel build
    if (e.key === 'Escape') {
      this.selectedEntities.clear();
      this.buildMode = null;
      this.ecs.emit('deselect');
    }

    // Space — center camera on player Con Yard
    if (e.key === ' ') {
      e.preventDefault();
      this._centerOnConYard();
    }

    // Delete — sell selected building
    if (e.key === 'Delete') {
      this._sellSelected();
    }

    // Control groups Ctrl+1..9 assign, 1..9 recall
    if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      this._controlGroups[e.key] = new Set(this.selectedEntities);
    } else if (!e.ctrlKey && e.key >= '1' && e.key <= '9') {
      const group = this._controlGroups[e.key];
      if (group?.size > 0) {
        this.selectedEntities = new Set([...group].filter(id => this.ecs.exists(id)));
        this.ecs.emit('select', [...this.selectedEntities]);
      }
    }

    // Camera scroll
    const pan = 20;
    if (e.key === 'ArrowLeft')  this.camera.pan(-pan, 0);
    if (e.key === 'ArrowRight') this.camera.pan( pan, 0);
    if (e.key === 'ArrowUp')    this.camera.pan(0, -pan);
    if (e.key === 'ArrowDown')  this.camera.pan(0,  pan);
    this.camera.clamp(this.map.width, this.map.height);
  }

  _handleLeftClick(sx, sy) {
    if (this.buildMode) {
      const tile = this.camera.screenToTile(sx, sy);
      this._placeBuilding(tile.x, tile.y);
      return;
    }

    const wc     = this.camera.screenToWorld(sx, sy);
    const target = this._entityAt(wc.x, wc.y);

    if (!this._keys.has('Shift')) {
      this.selectedEntities.clear();
    }

    if (target !== null) {
      this.selectedEntities.add(target);
      this.ecs.emit('select', [...this.selectedEntities]);
    } else {
      this.ecs.emit('deselect');
    }
  }

  _applySelectionRect(rect) {
    const wMin = this.camera.screenToWorld(rect.x1, rect.y1);
    const wMax = this.camera.screenToWorld(rect.x2, rect.y2);
    const nearby = this.spatial.queryRect(wMin.x, wMin.y, wMax.x, wMax.y);

    if (!this._keys.has('Shift')) this.selectedEntities.clear();

    for (const id of nearby) {
      const f = this.ecs.getComponent(id, COMP.FACTION);
      if (!f || !f.isPlayer) continue;
      if (this.ecs.hasComponent(id, COMP.UNIT)) {
        this.selectedEntities.add(id);
      }
    }
    this.ecs.emit('select', [...this.selectedEntities]);
  }

  _entityAt(wx, wy) {
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    if (this.map?.isInBounds(tx, ty)) {
      const buildingId = this.map.getBuilding?.(tx, ty);
      if (buildingId != null && buildingId !== -1 && this.ecs.exists(buildingId)) {
        return buildingId;
      }
    }

    const nearby = this.spatial.queryRadius(wx, wy, TILE_SIZE * 1.4);
    let best = null, bestDist = Infinity;
    for (const id of nearby) {
      const pos = this.ecs.getComponent(id, COMP.POSITION);
      if (!pos) continue;
      // Ignore ore fields
      if (this.ecs.hasComponent(id, COMP.ORE_FIELD)) continue;
      const d = Math.hypot(pos.x - wx, pos.y - wy);
      if (d < bestDist) { bestDist = d; best = id; }
    }
    return best;
  }

  _enemyEntityOnTile(tx, ty) {
    if (!this.map?.isInBounds(tx, ty)) return null;

    const buildingId = this.map.getBuilding?.(tx, ty);
    if (buildingId != null && buildingId !== -1 && this.ecs.exists(buildingId)) {
      return this._isEnemyEntity(buildingId) ? buildingId : null;
    }

    const minX = tx * TILE_SIZE;
    const minY = ty * TILE_SIZE;
    const maxX = minX + TILE_SIZE;
    const maxY = minY + TILE_SIZE;
    const nearby = this.spatial.queryRect(minX, minY, maxX, maxY);

    let best = null;
    let bestDist = Infinity;
    const cx = minX + TILE_SIZE * 0.5;
    const cy = minY + TILE_SIZE * 0.5;

    for (const id of nearby) {
      if (!this.ecs.hasComponent(id, COMP.UNIT)) continue;
      if (!this._isEnemyEntity(id)) continue;
      const pos = this.ecs.getComponent(id, COMP.POSITION);
      if (!pos) continue;
      const ux = Math.floor(pos.x / TILE_SIZE);
      const uy = Math.floor(pos.y / TILE_SIZE);
      if (ux !== tx || uy !== ty) continue;
      const d = Math.hypot(pos.x - cx, pos.y - cy);
      if (d < bestDist) { bestDist = d; best = id; }
    }

    return best;
  }

  _isEnemyEntity(id) {
    const faction = this.ecs.getComponent(id, COMP.FACTION);
    return !!faction && this.factionEnemies.get(this.playerFactionId)?.has(faction.id);
  }

  _placeBuilding(tx, ty) {
    if (!this.buildMode) return;
    const { key } = this.buildMode;
    const def     = (this.config.buildingConfigs || []).find(b => b.key === key);
    if (!def) return;
    const size    = def.size || 2;

    if (!this._canPlaceAt(tx, ty, size)) return;

    // Deduct credits
    const cost    = (def.cost || {})[CREDITS_KEY] ?? 0;
    const res     = this.factionResources[this.playerFactionId];
    if (!res || (res[CREDITS_KEY] || 0) < cost) return;
    res[CREDITS_KEY] -= cost;

    const id = this._spawnBuilding(key, this.playerFactionId, tx, ty, def);
    // Start construction animation (0→1 over build_time seconds)
    const bld = this.ecs.getComponent(id, COMP.BUILDING);
    bld.buildProgress = 0.0;
    bld.buildTime     = def.build_time || 10;

    this.buildMode = null;
    this.ecs.emit('buildingPlaced', key);
  }

  _canPlaceAt(tx, ty, size) {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        if (!this.map.isPassable(tx+dx, ty+dy)) return false;
        if (this.map.getBuilding?.(tx+dx, ty+dy) !== -1 && this.map.getBuilding?.(tx+dx, ty+dy) != null) return false;
      }
    }
    return true;
  }

  _sellSelected() {
    for (const id of this.selectedEntities) {
      if (!this.ecs.hasComponent(id, COMP.BUILDING)) continue;
      const f = this.ecs.getComponent(id, COMP.FACTION);
      if (!f?.isPlayer) continue;
      const bld = this.ecs.getComponent(id, COMP.BUILDING);
      const def = (this.config.buildingConfigs || []).find(b => b.key === bld.key);
      const refund = Math.floor(((def?.cost || {})[CREDITS_KEY] ?? 0) * 0.5);
      const res = this.factionResources[this.playerFactionId];
      if (res) res[CREDITS_KEY] = (res[CREDITS_KEY] || 0) + refund;
      this.particles?.explosion(
        (this.ecs.getComponent(id, COMP.POSITION) || {}).x,
        (this.ecs.getComponent(id, COMP.POSITION) || {}).y,
        0.5,
      );
      this.ecs.destroyEntity(id);
    }
    this.selectedEntities.clear();
  }

  _centerOnConYard() {
    for (const id of this.ecs.query(COMP.BUILDING, COMP.FACTION)) {
      const f = this.ecs.getComponent(id, COMP.FACTION);
      if (!f?.isPlayer) continue;
      const b = this.ecs.getComponent(id, COMP.BUILDING);
      const k = (b.key || '').toLowerCase();
      if (k.includes('castle') || k.includes('con_yard') || k.includes('hq') || k.includes('headquarters')) {
        const pos = this.ecs.getComponent(id, COMP.POSITION);
        this.camera.centerOn(pos.x, pos.y);
        return;
      }
    }
  }

  // -------------------------------------------------------
  // Victory check
  // -------------------------------------------------------

  _checkVictory() {
    let playerAlive = false, enemyAlive = false;
    for (const id of this.ecs.query(COMP.BUILDING, COMP.FACTION)) {
      const f = this.ecs.getComponent(id, COMP.FACTION);
      const b = this.ecs.getComponent(id, COMP.BUILDING);
      const k = (b.key || '').toLowerCase();
      const isBaseCore = b.isBaseCore
        || k.includes('castle')
        || k.includes('con_yard')
        || k.includes('construction')
        || k.includes('command')
        || k.includes('headquarters')
        || k.includes('hq');
      if (!isBaseCore) continue;
      if (f.isPlayer) playerAlive = true;
      else            enemyAlive  = true;
    }
    if (!playerAlive) this.ecs.emit('defeat');
    if (!enemyAlive)  this.ecs.emit('victory');
  }

  // -------------------------------------------------------
  // Spatial grid rebuild
  // -------------------------------------------------------

  _rebuildSpatialGrid() {
    this.spatial.clear?.();
    for (const id of this.ecs.query(COMP.POSITION)) {
      const pos = this.ecs.getComponent(id, COMP.POSITION);
      this.spatial.insert(id, pos.x, pos.y);
    }
  }

  // -------------------------------------------------------
  // Public API for Vue HUD
  // -------------------------------------------------------

  setBuildMode(key) {
    if (!key) { this.buildMode = null; return; }
    const def = (this.config.buildingConfigs || []).find(b => b.key === key);
    const meta = (this._factionMeta || {})[this.playerFactionId] || {};
    this.buildMode = {
      key,
      sprite:       def?.sprite      || '',
      category:     def?.category    || 'military',
      size:         def?.size        || 2,
      factionColor: meta.color       || '#4169e1',
      valid:        false,
    };
  }

  enqueueUnit(buildingId, unitKey) {
    return this.production?.enqueue(buildingId, unitKey) ?? false;
  }

  dequeueUnit(buildingId) {
    this.production?.dequeue(buildingId);
  }

  getStats() {
    const credits = (this.factionResources[this.playerFactionId] || {})[CREDITS_KEY] ?? 0;
    const pw      = this.factionPower[this.playerFactionId] || { supply: 0, drain: 0, deficit: false };
    return {
      tick:     this.tick,
      fps:      this.loop.fps,
      tps:      this.loop.tps,
      credits,
      power:    pw,
      entities: this.ecs.entityCount ?? 0,
    };
  }

  getSelectedInfo() {
    if (this.selectedEntities.size === 0) return null;
    const id      = [...this.selectedEntities][0];
    const unit    = this.ecs.getComponent(id, COMP.UNIT);
    const bld     = this.ecs.getComponent(id, COMP.BUILDING);
    const hp      = this.ecs.getComponent(id, COMP.HEALTH);
    const faction = this.ecs.getComponent(id, COMP.FACTION);
    const prod    = this.ecs.getComponent(id, COMP.PRODUCTION);
    const harv    = this.ecs.getComponent(id, COMP.HARVESTER);

    // For buildings: collect trainable unit defs
    let trainableUnits = [];
    if (bld) {
      const bldDef = (this.config.buildingConfigs || []).find(b => b.key === bld.key);
      trainableUnits = (bldDef?.trains || []).map(key =>
        (this.config.unitConfigs || []).find(u => u.key === key)
      ).filter(Boolean);
    }

    return {
      id,
      isUnit:     !!unit,
      isBuilding: !!bld,
      label:      unit?.key ?? bld?.key ?? '?',
      health:     hp,
      faction,
      unit,
      building:   bld,
      production: prod,
      harvester:  harv,
      trainableUnits,
      prodProgress: bld ? this.production?.getProgress(id) : 0,
      count:      this.selectedEntities.size,
    };
  }

  getPlayerCredits() {
    return (this.factionResources[this.playerFactionId] || {})[CREDITS_KEY] ?? 0;
  }

  getAvailableBuildings() {
    // Buildings the player can afford
    return (this.config.buildingConfigs || []).map(def => ({
      ...def,
      cost:        def.cost || {},
      canAfford:   ((def.cost || {})[CREDITS_KEY] ?? 0) <= this.getPlayerCredits(),
    }));
  }

  on(event, cb) { return this.ecs.on(event, cb); }

  resize(w, h) {
    this.canvas.width  = w;
    this.canvas.height = h;
    this.camera.resize(w, h);
    if (this.map) this.camera.clamp(this.map.width, this.map.height);
  }
}
