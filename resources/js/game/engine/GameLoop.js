import { TICKS_PER_SECOND } from '../constants.js';

/**
 * Fixed-timestep game loop.
 *
 * Render runs at display refresh rate (requestAnimationFrame).
 * Logic updates run at a fixed rate (TICKS_PER_SECOND).
 * This ensures deterministic simulation independent of frame rate.
 */
export class GameLoop {
  constructor(onTick, onRender) {
    this._onTick   = onTick;
    this._onRender = onRender;

    this._running    = false;
    this._rafId      = null;
    this._lastTime   = 0;
    this._accumulator = 0;

    // Fixed timestep in ms
    this.tickMs   = 1000 / TICKS_PER_SECOND;
    this.maxAccum = this.tickMs * 5; // prevent spiral-of-death

    // Stats
    this.fps        = 0;
    this.tps        = 0;   // actual ticks per second
    this._fpsFrames = 0;
    this._tpsCount  = 0;
    this._statTimer = 0;

    // Speed multiplier (1.0 = normal, 2.0 = fast, 0 = paused)
    this.speed = 1.0;
  }

  start() {
    if (this._running) return;
    this._running  = true;
    this._lastTime = performance.now();
    this._loop(this._lastTime);
  }

  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  pause()   { this.speed = 0; }
  resume()  { this.speed = 1.0; }
  setSpeed(s) { this.speed = Math.max(0, Math.min(8, s)); }

  _loop(timestamp) {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(t => this._loop(t));

    const raw  = timestamp - this._lastTime;
    this._lastTime = timestamp;

    // Apply speed & cap frame delta to avoid physics explosions
    const dt = Math.min(raw * this.speed, this.maxAccum);
    this._accumulator += dt;

    // Stat counter
    this._statTimer  += raw;
    this._fpsFrames++;
    if (this._statTimer >= 1000) {
      this.fps = this._fpsFrames;
      this.tps = this._tpsCount;
      this._fpsFrames = 0;
      this._tpsCount  = 0;
      this._statTimer -= 1000;
    }

    // Run as many fixed ticks as needed
    while (this._accumulator >= this.tickMs) {
      this._onTick(this.tickMs / 1000);  // pass dt in seconds
      this._accumulator -= this.tickMs;
      this._tpsCount++;
    }

    // Interpolation factor (0..1) for smooth rendering
    const alpha = this._accumulator / this.tickMs;
    this._onRender(alpha);
  }
}
