/**
 * EventSystem — fires dynamic world events on fixed per-event timers.
 * Example: interval_seconds: 300 triggers an event every five minutes.
 */
export class EventSystem {
  constructor(ecs, map, factionResources, config, activeEvents) {
    this.ecs              = ecs;
    this.map              = map;
    this.factionResources = factionResources;
    this.config           = config;
    this.activeEvents     = activeEvents; // shared mutable array
    this._timers          = new Map(); // event key -> elapsed seconds
  }

  update(dt) {
    // Tick active events
    for (let i = this.activeEvents.length - 1; i >= 0; i--) {
      const ev = this.activeEvents[i];
      ev.remainingSeconds -= dt;

      if (ev.remainingSeconds <= 0) {
        this._resolveEvent(ev);
        this.activeEvents.splice(i, 1);
      }
    }

    const eventConfigs = this.config.eventConfigs || [];
    for (const def of eventConfigs) {
      if (!this._checkConditions(def.conditions)) continue;

      const key = def.key;
      const interval = Math.max(1, Number(def.interval_seconds ?? 300));
      const elapsed = (this._timers.get(key) ?? 0) + dt;
      if (elapsed < interval) {
        this._timers.set(key, elapsed);
        continue;
      }

      this._timers.set(key, elapsed % interval);
      this._fireEvent(def);
    }
  }

  _checkConditions(conditions) {
    if (!conditions) return true;

    // Resource condition
    if (conditions.resource_below) {
      for (const [fId, res] of Object.entries(this.factionResources)) {
        const [resource, threshold] = Object.entries(conditions.resource_below)[0];
        if ((res[resource] || 0) < threshold) return true;
      }
    }

    return true;
  }

  _fireEvent(def) {
    const { ecs } = this;

    // Apply immediate effects to all factions (or targeted)
    const effects = def.effects || {};

    if (effects.immediate) {
      for (const [fId, res] of Object.entries(this.factionResources)) {
        for (const [r, delta] of Object.entries(effects.immediate)) {
          res[r] = Math.max(0, (res[r] || 0) + delta);
        }
      }
    }

    const duration = def.duration ?? 0;
    const event = {
      key:           def.key,
      name:          def.name,
      type:          def.type,
      description:   def.description,
      effects:       effects,
      choices:       def.choices || [],
      remainingSeconds: duration > 0 ? duration : 0,
    };

    if (duration > 0) {
      this.activeEvents.push(event);
      // Apply recurring effect onset
      if (effects.per_tick) {
        event._perTickEffects = effects.per_tick;
      }
    }

    ecs.emit('event', event);
  }

  _resolveEvent(event) {
    const effects = event.effects || {};

    // Apply end effects
    if (effects.on_end) {
      for (const [fId, res] of Object.entries(this.factionResources)) {
        for (const [r, delta] of Object.entries(effects.on_end)) {
          res[r] = Math.max(0, (res[r] || 0) + delta);
        }
      }
    }

    this.ecs.emit('eventResolved', event);
  }

  /** Player makes a choice for an active event */
  makeChoice(eventKey, choiceIndex) {
    const event = this.activeEvents.find(e => e.key === eventKey);
    if (!event) return;

    const choice = event.choices[choiceIndex];
    if (!choice) return;

    const consequences = choice.consequences || {};
    for (const [fId, res] of Object.entries(this.factionResources)) {
      for (const [r, delta] of Object.entries(consequences)) {
        res[r] = Math.max(0, (res[r] || 0) + delta);
      }
    }

    // Resolve event immediately after choice
    event.remainingSeconds = 0;
    this.ecs.emit('eventChoice', { event, choice });
  }

  /** Manually trigger an event by key (for testing/scenario scripts) */
  triggerEvent(key) {
    const def = (this.config.eventConfigs || []).find(e => e.key === key);
    if (def) this._fireEvent(def);
  }
}
