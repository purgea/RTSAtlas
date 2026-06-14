/**
 * OpenSimplex2 noise (2D) — seeded, fast, high quality.
 * Based on Kurt Spencer's public domain implementation.
 */
export class NoiseGenerator {
  constructor(seed) {
    this._perm   = new Int16Array(2048);
    this._permGrad2 = new Array(2048);
    this._init(seed);
  }

  _init(seed) {
    const source = new Int16Array(2048);
    for (let i = 0; i < 2048; i++) source[i] = i & 0xff;

    // LCG shuffle
    seed = BigInt(seed >>> 0);
    for (let i = 2047; i >= 0; i--) {
      seed = (seed * 6364136223846793005n + 1442695040888963407n) & 0xFFFFFFFFFFFFFFFFn;
      const r = Number((seed + 31n) % BigInt(i + 1));
      this._perm[i] = source[r];
      source[r] = source[i];
    }

    const GRAD2 = [
      [0.130526192220052,  0.99144486137381],
      [0.38268343236509,   0.923879532511287],
      [0.608761429008721,  0.793353340291235],
      [0.793353340291235,  0.608761429008721],
      [0.923879532511287,  0.38268343236509],
      [0.99144486137381,   0.130526192220052],
      [0.99144486137381,  -0.130526192220052],
      [0.923879532511287, -0.38268343236509],
      [0.608761429008721, -0.793353340291235],
      [0.793353340291235, -0.608761429008721],
      [0.38268343236509,  -0.923879532511287],
      [0.130526192220052, -0.99144486137381],
      [-0.130526192220052,-0.99144486137381],
      [-0.38268343236509, -0.923879532511287],
      [-0.608761429008721,-0.793353340291235],
      [-0.793353340291235,-0.608761429008721],
      [-0.923879532511287,-0.38268343236509],
      [-0.99144486137381, -0.130526192220052],
      [-0.99144486137381,  0.130526192220052],
      [-0.923879532511287, 0.38268343236509],
      [-0.608761429008721, 0.793353340291235],
      [-0.793353340291235, 0.608761429008721],
      [-0.38268343236509,  0.923879532511287],
      [-0.130526192220052, 0.99144486137381],
    ];

    for (let i = 0; i < 2048; i++) {
      this._permGrad2[i] = GRAD2[this._perm[i] % GRAD2.length];
    }
  }

  /** Returns noise value in [-1, 1] */
  eval2(xin, yin) {
    const SQUISH = (Math.sqrt(3) - 1) / 2;
    const UNSQUISH = (3 - Math.sqrt(3)) / 6;

    const stretchOffset = (xin + yin) * SQUISH;
    const xs = xin + stretchOffset;
    const ys = yin + stretchOffset;

    const xsb = Math.floor(xs);
    const ysb = Math.floor(ys);

    const squishOffset = (xsb + ysb) * UNSQUISH;
    const xb = xsb + squishOffset;
    const yb = ysb + squishOffset;

    const xins = xs - xsb;
    const yins = ys - ysb;
    const inSum = xins + yins;

    const dx0 = xin - xb;
    const dy0 = yin - yb;

    let value = 0;

    // Contribution (1,0)
    const dx1 = dx0 - 1 - UNSQUISH;
    const dy1 = dy0 - 0 - UNSQUISH;
    let attn1 = 2 - dx1 * dx1 - dy1 * dy1;
    if (attn1 > 0) {
      attn1 *= attn1;
      value += attn1 * attn1 * this._extrapolate(xsb + 1, ysb + 0, dx1, dy1);
    }

    // Contribution (0,1)
    const dx2 = dx0 - 0 - UNSQUISH;
    const dy2 = dy0 - 1 - UNSQUISH;
    let attn2 = 2 - dx2 * dx2 - dy2 * dy2;
    if (attn2 > 0) {
      attn2 *= attn2;
      value += attn2 * attn2 * this._extrapolate(xsb + 0, ysb + 1, dx2, dy2);
    }

    if (inSum <= 1) {
      // Inside the triangle at (0,0)
      let attn0 = 1 - inSum;
      attn0 *= attn0; attn0 *= attn0;
      value += attn0 * this._extrapolate(xsb, ysb, dx0, dy0);
    } else {
      // Inside the triangle at (1,1)
      const dx3 = dx0 - 1 - 2 * UNSQUISH;
      const dy3 = dy0 - 1 - 2 * UNSQUISH;
      let attn3 = 2 - dx3 * dx3 - dy3 * dy3;
      if (attn3 > 0) {
        attn3 *= attn3;
        value += attn3 * attn3 * this._extrapolate(xsb + 1, ysb + 1, dx3, dy3);
      }
    }

    return value / 47;
  }

  _extrapolate(xsb, ysb, dx, dy) {
    const idx = (this._perm[(this._perm[xsb & 0xff] + ysb) & 0xff]) & 0xff;
    const g = this._permGrad2[idx];
    return g[0] * dx + g[1] * dy;
  }

  /**
   * Fractal Brownian Motion — layered octaves for natural-looking terrain.
   * @returns value in [0, 1] (normalised from [-1, 1])
   */
  fbm(x, y, octaves = 6, lacunarity = 2.0, gain = 0.5) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1.0;
    let maxValue  = 0;

    for (let o = 0; o < octaves; o++) {
      value    += amplitude * this.eval2(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return (value / maxValue + 1) * 0.5; // normalise to [0,1]
  }
}
