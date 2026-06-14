// EventSystem removed — random events conflict with C&C pacing
import { SeededRandom } from '../utils/SeededRandom.js';

/**
 * EventSystem — fires dynamic world events based on game state.
 * Each event has conditions, probability, duration, and effects.
 */
export class EventSystem {
  constructor(ecs, map, factionResources, config, activeEvents) {
    this.ecs              = ecs;
    this.map              = map;
    this.factionResources = factionResources;
    this.config           = config;
    this.activeEvents     = activeEvents; // shared mutable array
    this._rng             = new SeededRandom(Date.now());
    this._checkInterval   = TICKS_PER_SECOND * 30; // check every 30s
  }

  update(dt, tick, gameYear) {
    // Tick active events
    for (let i = this.activeEvents.length - 1; i >= 0; i--) {
      const ev = this.activeEvents[i];
      ev.remainingTicks -= 1;

      if (ev.remainingTicks <= 0) {
        this._resolveEvent(ev);
        this.activeEvents.splice(i, 1);
      }
    }

    // Check for new events
    if (tick % this._checkInterval !== 0) return;

    const eventConfigs = this.config.eventConfigs || [];
    for (const def of eventConfigs) {
      if (!this._checkConditions(def.conditions, gameYear)) continue;
      if (!this._rng.chance(def.base_probability ?? 0.05)) continue;

      this._fireEvent(def, gameYear);
    }
  }

  _checkConditions(conditions, gameYear) {
    if (!conditions) return true;

    if (conditions.min_year && gameYear < conditions.min_year) return false;
    if (conditions.max_year && gameYear > conditions.max_year) return false;

    // Resource condition
    if (conditions.resource_below) {
      for (const [fId, res] of Object.entries(this.factionResources)) {
        const [resource, threshold] = Object.entries(conditions.resource_below)[0];
        if ((res[resource] || 0) < threshold) return true;
      }
    }

    return true;
  }

  _fireEvent(def, gameYear) {
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
      remainingTicks: duration > 0 ? duration * TICKS_PER_SECOND : 1,
      gameYear,
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
    event.remainingTicks = 0;
    this.ecs.emit('eventChoice', { event, choice });
  }

  /** Manually trigger an event by key (for testing/scenario scripts) */
  triggerEvent(key) {
    const def = (this.config.eventConfigs || []).find(e => e.key === key);
    if (def) this._fireEvent(def, 0);
  }
}
