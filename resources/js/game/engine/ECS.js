/**
 * Entity-Component-System (ECS) core.
 *
 * Entities  → plain integer IDs
 * Components → plain JS objects stored in typed Maps
 * Systems   → registered separately in GameEngine
 */
export class ECS {
  constructor() {
    this._nextId = 1;
    this.entities = new Set();
    /** @type {Map<string, Map<number, object>>} */
    this.components = new Map();
    /** @type {Map<number, Set<string>>} */
    this._entityComps = new Map();
    /** @type {Map<string, Array<Function>>} */
    this._listeners = new Map();
    /** @type {Map<number, string>} optional debug labels */
    this._labels = new Map();
  }

  // -------------------------------------------------------
  // Entity lifecycle
  // -------------------------------------------------------

  createEntity(label = '') {
    const id = this._nextId++;
    this.entities.add(id);
    this._entityComps.set(id, new Set());
    if (label) this._labels.set(id, label);
    return id;
  }

  destroyEntity(id) {
    if (!this.entities.has(id)) return;
    for (const name of (this._entityComps.get(id) || [])) {
      this.components.get(name)?.delete(id);
    }
    this._entityComps.delete(id);
    this._labels.delete(id);
    this.entities.delete(id);
    this.emit('entityDestroyed', id);
  }

  exists(id) {
    return this.entities.has(id);
  }

  getLabel(id) {
    return this._labels.get(id) ?? '';
  }

  // -------------------------------------------------------
  // Component management
  // -------------------------------------------------------

  addComponent(entityId, name, data = {}) {
    if (!this.components.has(name)) this.components.set(name, new Map());
    this.components.get(name).set(entityId, data);
    this._entityComps.get(entityId)?.add(name);
    return data;
  }

  getComponent(entityId, name) {
    return this.components.get(name)?.get(entityId) ?? null;
  }

  hasComponent(entityId, name) {
    return this.components.get(name)?.has(entityId) ?? false;
  }

  removeComponent(entityId, name) {
    this.components.get(name)?.delete(entityId);
    this._entityComps.get(entityId)?.delete(name);
  }

  /** Update component data (shallow merge) */
  updateComponent(entityId, name, patch) {
    const comp = this.getComponent(entityId, name);
    if (comp) Object.assign(comp, patch);
    return comp;
  }

  // -------------------------------------------------------
  // Queries
  // -------------------------------------------------------

  /**
   * Returns array of entity IDs that have ALL listed components.
   * @param {...string} names
   */
  query(...names) {
    const [first, ...rest] = names;
    const primary = this.components.get(first);
    if (!primary) return [];

    const result = [];
    for (const [id] of primary) {
      if (rest.every(n => this.hasComponent(id, n))) {
        result.push(id);
      }
    }
    return result;
  }

  /**
   * Like query() but also returns component objects.
   * Returns array of { entityId, [ComponentName]: data, ... }
   */
  queryWith(...names) {
    const [first, ...rest] = names;
    const primary = this.components.get(first);
    if (!primary) return [];

    const result = [];
    for (const [id] of primary) {
      if (rest.every(n => this.hasComponent(id, n))) {
        const entry = { entityId: id };
        for (const n of names) entry[n] = this.components.get(n).get(id);
        result.push(entry);
      }
    }
    return result;
  }

  // -------------------------------------------------------
  // Events (simple pub/sub)
  // -------------------------------------------------------

  on(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(cb);
    return () => this.off(event, cb);
  }

  off(event, cb) {
    const list = this._listeners.get(event);
    if (list) {
      const idx = list.indexOf(cb);
      if (idx !== -1) list.splice(idx, 1);
    }
  }

  emit(event, ...args) {
    const list = this._listeners.get(event);
    if (!list) return;
    for (const cb of list) cb(...args);
  }

  // -------------------------------------------------------
  // Serialisation
  // -------------------------------------------------------

  serialize() {
    const comps = {};
    for (const [name, map] of this.components) {
      comps[name] = [...map.entries()];
    }
    return {
      nextId:   this._nextId,
      entities: [...this.entities],
      labels:   [...this._labels.entries()],
      comps,
    };
  }

  deserialize(snapshot) {
    this._nextId = snapshot.nextId;
    this.entities = new Set(snapshot.entities);
    this._entityComps = new Map();
    this.components = new Map();
    this._labels = new Map(snapshot.labels || []);

    for (const id of this.entities) {
      this._entityComps.set(id, new Set());
    }
    for (const [name, entries] of Object.entries(snapshot.comps || {})) {
      const map = new Map(entries);
      this.components.set(name, map);
      for (const [id] of map) {
        this._entityComps.get(id)?.add(name);
      }
    }
  }

  // -------------------------------------------------------
  // Stats
  // -------------------------------------------------------

  get entityCount() { return this.entities.size; }

  get componentTypeCount() { return this.components.size; }

  stats() {
    const counts = {};
    for (const [name, map] of this.components) counts[name] = map.size;
    return { entities: this.entities.size, components: counts };
  }
}
