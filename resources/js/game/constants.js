// ============================================================
// Game Constants — C&C-style RTS
// All gameplay values are defaults; final values come from editor project config.
// ============================================================

export const TILE = Object.freeze({
  GRASS:      0,
  FOREST:     1,
  MOUNTAIN:   2,
  WATER:      3,
  SAND:       4,
  SNOW:       5,
  ROAD:       6,
  RUINS:      7,
  DEEP_WATER: 8,
  SWAMP:      9,
  FARMLAND:   10,
  CLIFF:      11,
});

export const TERRAIN_COLOR = Object.freeze({
  0:  '#4a7c4e',  // GRASS
  1:  '#2d5a27',  // FOREST
  2:  '#7a6548',  // MOUNTAIN
  3:  '#3a5fa0',  // WATER
  4:  '#b89a5a',  // SAND
  5:  '#cdd8e0',  // SNOW
  6:  '#6e5c42',  // ROAD
  7:  '#555555',  // RUINS
  8:  '#1a2f7a',  // DEEP_WATER
  9:  '#3d5535',  // SWAMP
  10: '#5a7c3a',  // FARMLAND
  11: '#4a3a2a',  // CLIFF
});

export const TERRAIN_PASSABLE = Object.freeze({
  0: true,  1: false, 2: false, 3: false, 4: true,
  5: true,  6: true,  7: true,  8: false, 9: true,
  10: true, 11: false,
});

// Movement cost multiplier per terrain type
export const TERRAIN_COST = Object.freeze({
  0: 1.0, 1: 9.9, 2: 9.9, 3: 9.9, 4: 1.2,
  5: 1.4, 6: 0.6, 7: 1.1, 8: 9.9, 9: 1.8,
  10: 1.0, 11: 9.9,
});

// -------------------------------------------------------
// Unit roles — derived from unit.category in project config
// -------------------------------------------------------
export const UNIT_ROLE = Object.freeze({
  INFANTRY:  'infantry',   // foot soldiers — soldier, archer, grenadier, priest
  VEHICLE:   'vehicle',    // tracked/wheeled — scout, knight, siege
  SPECIAL:   'special',    // merchant, unique units
});

// Maps editor category values to engine UNIT_ROLE
export function categoryToRole(cat) {
  if (!cat) return UNIT_ROLE.INFANTRY;
  const c = cat.toLowerCase();
  if (c === 'knight' || c === 'siege' || c === 'scout') return UNIT_ROLE.VEHICLE;
  if (c === 'merchant' || c === 'priest' || c === 'special') return UNIT_ROLE.SPECIAL;
  return UNIT_ROLE.INFANTRY;
}

// Primary currency key — must match a resource_config key in the editor
export const CREDITS_KEY = 'gold';

// Power field in building.provides — buildings set {"power": +20} or {"power": -5}
export const POWER_KEY = 'power';

// Harvester config — reads from unit with category 'worker' or 'harvester'

// Production config
export const POWER_DEFICIT_PENALTY = 0.5; // 50% production speed when under-powered

// C&C building role detection — checks building.key patterns
export const BUILDING_ROLE = Object.freeze({
  CON_YARD:    'con_yard',
  BARRACKS:    'barracks',
  WAR_FACTORY: 'war_factory',
  REFINERY:    'refinery',
  POWER_PLANT: 'power_plant',
  ORE_SILO:    'ore_silo',
  RADAR:       'radar',
  DEFENCE:     'defence',
});

// ECS component names
export const COMP = Object.freeze({
  POSITION:     'Position',
  VELOCITY:     'Velocity',
  HEALTH:       'Health',
  COMBAT:       'Combat',
  MOVEMENT:     'Movement',
  PATHFINDING:  'Pathfinding',
  FACTION:      'Faction',
  UNIT:         'Unit',
  BUILDING:     'Building',
  SELECTABLE:   'Selectable',
  RENDER:       'Render',
  AI:           'AI',
  ORE_FIELD:    'OreField',
  PRODUCTION:   'Production',
  PROJECTILE:   'Projectile',
  PARTICLE_EMITTER: 'ParticleEmitter',
  CONTROL_GROUP:'ControlGroup',
  ORDER:        'Order',
  POWER:        'Power',
});

export const TILE_SIZE        = 32;   // pixels per tile
export const TICKS_PER_SECOND = 20;   // fixed logic rate
export const SECONDS_PER_YEAR = 300;  // in-game year length

// Ore field regen rate (ore per second)
