// Mulberry32 — fast, seeded, deterministic PRNG
export class SeededRandom {
  constructor(seed) {
    this.seed = (seed >>> 0) || 1;
  }

  next() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Float in [min, max) */
  nextFloat(min = 0, max = 1) {
    return this.next() * (max - min) + min;
  }

  /** True with probability p */
  chance(p) {
    return this.next() < p;
  }

  /** Fisher-Yates in-place shuffle */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted pick: weights array sums to any positive value */
  weightedPick(items, weights) {
    let total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** Gaussian approximation via Box-Muller */
  gaussian(mean = 0, std = 1) {
    const u = 1 - this.next();
    const v = this.next();
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  clone() {
    return new SeededRandom(this.seed);
  }
}
